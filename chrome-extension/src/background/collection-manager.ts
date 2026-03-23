/**
 * 采集管理器
 * 打开 Ahrefs 页面后，通过 content script 启动 API 拦截并回传数据
 */

import { messageRouter } from './message-router';
import { bindCollectionTab, unbindCollectionTab } from './web-request-manager';
import { OpportunityStatus, PageType, LinkType, SourcePlatform } from '@extension/shared';
import { opportunityStorage, collectionBatchStorage, managedBacklinkStorage } from '@extension/storage';
import type { Opportunity, CollectedBacklink, ManagedBacklink } from '@extension/shared';

/**
 * 指数退避重试工具函数
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 判断是否为临时错误（可重试）
 */
const isTemporaryError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();

  // 网络相关错误
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return true;
  }
  // 超时错误
  if (message.includes('timeout') || message.includes('timed out')) {
    return true;
  }
  // 503 服务不可用
  if (message.includes('503') || message.includes('service unavailable')) {
    return true;
  }
  // 429 请求过多
  if (message.includes('429') || message.includes('too many requests')) {
    return true;
  }

  return false;
};

/**
 * 带指数退避的重试函数
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 永久错误不重试
      if (!isTemporaryError(error)) {
        console.log('[Collection Manager] 永久错误，不重试:', error);
        throw error;
      }

      // 已达最大重试次数
      if (i === maxRetries - 1) {
        break;
      }

      // 指数退避 + 随机抖动
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.log(`[Collection Manager] 临时错误，${delay.toFixed(0)}ms 后重试 (${i + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }

  throw lastError;
}

interface CollectionResult {
  success: boolean;
  count?: number;
  addedToLibrary?: number;
  skippedInLibrary?: number;
  groupId?: string;
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
 * 采集回调接口
 */
export interface CollectionCallbacks {
  onCollectionStart?: (targetUrl: string) => void;
  onCollectionComplete?: (result: CollectionResult) => void;
  onCollectionError?: (error: Error) => void;
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

const installAhrefsMainWorldBridge = (): void => {
  const BRIDGE_CHANNEL = '__LINK_PILOT_AHREFS_BRIDGE__';
  const BRIDGE_SOURCE_MAIN = 'link_pilot_ahrefs_main';
  const BRIDGE_SOURCE_CONTENT = 'link_pilot_ahrefs_content';
  const BRIDGE_STATE_KEY = '__linkPilotAhrefsBridgeState__';

  type BridgePayload = Record<string, unknown> | undefined;
  type BridgeMessage = {
    channel: string;
    source: string;
    type: string;
    payload?: BridgePayload;
  };
  type BridgeState = {
    active: boolean;
    readyForStreaming: boolean;
    originalFetch: typeof window.fetch;
    originalXhrOpen: typeof XMLHttpRequest.prototype.open;
    originalXhrSend: typeof XMLHttpRequest.prototype.send;
    bufferedResponses: Array<{ url: string; data: unknown }>;
    listenerBound: boolean;
    stop: () => void;
  };

  const win = window as unknown as Window & Record<string, unknown>;
  const existingState = win[BRIDGE_STATE_KEY] as BridgeState | undefined;

  const emit = (type: string, payload?: BridgePayload): void => {
    const message: BridgeMessage = {
      channel: BRIDGE_CHANNEL,
      source: BRIDGE_SOURCE_MAIN,
      type,
      payload,
    };
    window.postMessage(message, '*');
  };

  if (existingState?.listenerBound) {
    emit('BRIDGE_READY', { reused: true });
    return;
  }

  const state: BridgeState = {
    active: false,
    readyForStreaming: false,
    originalFetch: window.fetch,
    originalXhrOpen: XMLHttpRequest.prototype.open,
    originalXhrSend: XMLHttpRequest.prototype.send,
    bufferedResponses: [],
    listenerBound: true,
    stop: () => {
      if (!state.active) {
        return;
      }
      state.active = false;
      state.readyForStreaming = false;
      window.fetch = state.originalFetch;
      XMLHttpRequest.prototype.open = state.originalXhrOpen;
      XMLHttpRequest.prototype.send = state.originalXhrSend;
      emit('INTERCEPTOR_STOPPED');
    },
  };

  const emitApiResponse = (url: string, data: unknown): void => {
    if (!state.readyForStreaming) {
      state.bufferedResponses.push({ url, data });
      if (state.bufferedResponses.length > 60) {
        state.bufferedResponses = state.bufferedResponses.slice(-60);
      }
      return;
    }

    emit('API_RESPONSE', { url, data });
  };

  const flushBufferedResponses = (): void => {
    if (!state.readyForStreaming || state.bufferedResponses.length === 0) {
      return;
    }
    const backlog = state.bufferedResponses.slice();
    state.bufferedResponses = [];
    backlog.forEach(item => {
      emit('API_RESPONSE', { url: item.url, data: item.data });
    });
  };

  const isAhrefsApiRequest = (url: string): boolean => {
    // 精确匹配 Ahrefs API 端点
    const apiPatterns = [
      /ahrefs\.com\/v\d+\/stGetFreeBacklinksList/i,
      /ahrefs\.com\/v\d+\/stGetRefDomains/i,
      /ahrefs\.com\/v\d+\/stGetOrganicKeywords/i,
      /ahrefs\.com\/v\d+\/stGetContentGap/i,
      /ahrefs\.com\/v\d+\/stGetTopPages/i,
      /ahrefs\.com\/v\d+\/stGetBacklinks/i,
    ];
    return apiPatterns.some(pattern => pattern.test(url));
  };

  const getUrlFromResource = (resource: RequestInfo | URL): string => {
    if (typeof resource === 'string') {
      return resource;
    }
    if (resource instanceof URL) {
      return resource.toString();
    }
    return resource.url;
  };

  const start = (readyForStreaming: boolean): void => {
    if (readyForStreaming) {
      state.readyForStreaming = true;
    }

    if (state.active) {
      flushBufferedResponses();
      emit('BRIDGE_READY', { reused: true });
      return;
    }

    state.active = true;

    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [resource] = args;
      const url = getUrlFromResource(resource);
      const matched = isAhrefsApiRequest(url);

      if (state.active) {
        emit('REQUEST_SEEN', {
          transport: 'fetch',
          url,
          matched,
        });
      }

      const response = await state.originalFetch.call(window, ...args);

      if (state.active && matched) {
        try {
          const payload = await response.clone().json();
          emitApiResponse(url, payload);
        } catch (error) {
          emit('BRIDGE_ERROR', {
            error: error instanceof Error ? error.message : '解析 fetch 响应失败',
            url,
            transport: 'fetch',
          });
        }
      }

      return response;
    };

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]): void {
      (this as XMLHttpRequest & { __linkPilotUrl?: string }).__linkPilotUrl = url.toString();
      return state.originalXhrOpen.apply(this, [method, url, ...rest] as Parameters<
        typeof XMLHttpRequest.prototype.open
      >);
    };

    XMLHttpRequest.prototype.send = function (...args): void {
      const xhr = this as XMLHttpRequest & { __linkPilotUrl?: string };
      const url = xhr.__linkPilotUrl || '';
      const matched = isAhrefsApiRequest(url);

      if (state.active && url) {
        emit('REQUEST_SEEN', {
          transport: 'xhr',
          url,
          matched,
        });
      }

      if (state.active && matched) {
        xhr.addEventListener('load', () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            return;
          }
          try {
            const payload = JSON.parse(xhr.responseText);
            emitApiResponse(url, payload);
          } catch (error) {
            emit('BRIDGE_ERROR', {
              error: error instanceof Error ? error.message : '解析 XHR 响应失败',
              url,
              transport: 'xhr',
            });
          }
        });
      }

      state.originalXhrSend.apply(this, args as Parameters<typeof XMLHttpRequest.prototype.send>);
    };

    flushBufferedResponses();
    emit('BRIDGE_READY', { ready: true });
  };

  window.addEventListener('message', event => {
    const message = event.data as BridgeMessage | undefined;
    if (event.source !== window || !message || typeof message !== 'object') {
      return;
    }
    if (message.channel !== BRIDGE_CHANNEL || message.source !== BRIDGE_SOURCE_CONTENT) {
      return;
    }

    if (message.type === 'START_INTERCEPT') {
      start(true);
      // 发送确认响应
      emit('INTERCEPT_STARTED', {
        success: true,
        bufferedCount: state.bufferedResponses.length
      });
      return;
    }
    if (message.type === 'STOP_INTERCEPT') {
      state.stop();
    }
  });

  window.addEventListener('beforeunload', () => {
    state.stop();
  });

  // 自动启动底层拦截，尽可能提前捕获请求；数据会在 content script 就绪后回放。
  start(false);

  win[BRIDGE_STATE_KEY] = state;
  emit('BRIDGE_READY', { installed: true });
};

/**
 * 采集管理器类
 */
class CollectionManager {
  public static readonly DEBUG_LOG_KEY = 'collection_debug_logs';
  private static readonly MAX_DEBUG_LOGS = 300;
  private activeTab: ActiveTab | null = null;
  private currentBatchId: string | null = null;
  // URL 缓存机制 - 减少 getAll 调用
  private urlCache = new Set<string>();
  private domainCache = new Set<string>();
  private cacheLastRefresh = 0;
  private static readonly CACHE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟刷新

  /**
   * 初始化管理器
   */
  init(): void {
    console.log('[Collection Manager] 初始化');
    console.log('[Collection Manager] 管理器初始化完成');
  }

  /**
   * 获取 URL 缓存（带自动刷新）
   */
  private async getUrlCache(): Promise<{ urls: Set<string>; domains: Set<string> }> {
    const now = Date.now();
    if (now - this.cacheLastRefresh > CollectionManager.CACHE_REFRESH_INTERVAL) {
      // 缓存过期，重新加载
      const allOpportunities = await opportunityStorage.getAll();
      this.urlCache.clear();
      this.domainCache.clear();
      for (const opp of allOpportunities) {
        this.urlCache.add(this.normalizeUrl(opp.url));
        this.domainCache.add(opp.domain.toLowerCase());
      }
      this.cacheLastRefresh = now;
      console.log('[Collection Manager] URL 缓存已刷新，缓存大小:', this.urlCache.size);
    }
    return { urls: this.urlCache, domains: this.domainCache };
  }

  /**
   * 手动刷新缓存
   */
  async refreshUrlCache(): Promise<void> {
    const allOpportunities = await opportunityStorage.getAll();
    this.urlCache.clear();
    this.domainCache.clear();
    for (const opp of allOpportunities) {
      this.urlCache.add(this.normalizeUrl(opp.url));
      this.domainCache.add(opp.domain.toLowerCase());
    }
    this.cacheLastRefresh = Date.now();
    console.log('[Collection Manager] URL 缓存已手动刷新，缓存大小:', this.urlCache.size);
  }

  /**
   * 开始手动采集
   */
  async startManualCollection(
    targetUrl: string,
    maxCount: number = 20,
    targetGroupId?: string,
    collectionUrlOverride?: string,
    callbacks?: CollectionCallbacks,
    reuseTabId?: number, // 新增：复用现有标签页
  ): Promise<CollectionResult> {
    let tabId: number | null = null;
    let shouldCloseTab = true; // 是否应该关闭标签页

    try {
      await this.resetDebugLogs({
        action: 'START_MANUAL_COLLECTION',
        targetUrl,
        maxCount,
        at: new Date().toISOString(),
      });
      await this.logInfo('开始手动采集', { targetUrl, maxCount, reuseTabId });

      // 调用开始回调
      callbacks?.onCollectionStart?.(targetUrl);

      // 重置状态
      this.currentBatchId = crypto.randomUUID();

      // 打开 Ahrefs Backlink Checker 页面（测试场景可覆盖 URL）
      const ahrefsUrl =
        collectionUrlOverride || `https://ahrefs.com/backlink-checker?input=${encodeURIComponent(targetUrl)}`;

      let tab: chrome.tabs.Tab;

      // 方案 3：会话保持 - 复用现有标签页
      if (reuseTabId) {
        try {
          // 检查标签页是否存在
          tab = await chrome.tabs.get(reuseTabId);

          // 增强验证：检查标签页是否可用
          if (tab.status === 'loading') {
            await this.logWarn('复用标签页正在加载，等待完成', { tabId: reuseTabId });
            // 等待标签页加载完成
            await this.waitForTabLoad(reuseTabId);
          }

          // 检查标签页是否被废弃（discarded）
          if (tab.discarded) {
            await this.logWarn('复用标签页已被废弃，重新创建', { tabId: reuseTabId });
            tab = await chrome.tabs.create({
              url: ahrefsUrl,
              active: true,
            });
          } else {
            // 导航到新 URL
            await chrome.tabs.update(reuseTabId, { url: ahrefsUrl, active: true });
            await this.logInfo('复用现有标签页', { tabId: reuseTabId, ahrefsUrl });
          }
          shouldCloseTab = false; // 不关闭复用的标签页
        } catch (error) {
          // 标签页不存在或其他错误，创建新的
          await this.logWarn('复用标签页失败，创建新标签页', {
            error: error instanceof Error ? error.message : String(error),
          });
          tab = await chrome.tabs.create({
            url: ahrefsUrl,
            active: true,
          });
        }
      } else {
        tab = await chrome.tabs.create({
          url: ahrefsUrl,
          active: true,
        });
      }

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
      bindCollectionTab(tab.id, this.currentBatchId!, targetUrl);

      // 等待页面加载完成
      await this.waitForTabLoad(tab.id);
      await this.logInfo('页面加载完成', { tabId: tab.id, tabUrl: tab.url });

      // 检查是否遇到验证页面
      const verificationCheck = await this.sendMessageToTab<{ isVerification?: boolean; type?: string; message?: string }>(tab.id, {
        type: 'CHECK_VERIFICATION_PAGE'
      }).catch(error => {
        void this.logWarn('验证页面检测失败', { tabId: tab.id, error: error instanceof Error ? error.message : String(error) });
        return null;
      });

      if (verificationCheck?.isVerification) {
        await this.logWarn('检测到验证页面', {
          tabId: tab.id,
          type: verificationCheck.type,
          message: verificationCheck.message
        });
        // 等待验证完成
        await this.logInfo('等待验证完成...', { tabId: tab.id });
        const waitResult = await this.sendMessageToTab<{ completed?: boolean }>(tab.id, {
          type: 'WAIT_FOR_VERIFICATION',
          payload: { timeoutMs: 120000 }
        }).catch(() => ({ completed: false }));

        if (!waitResult?.completed) {
          throw new Error('验证超时或被阻止');
        }
        await this.logInfo('验证完成，继续采集', { tabId: tab.id });
      }

      // 额外等待，确保页面完全稳定
      // 随机延迟 1-2 秒
      const stabilizeDelay = 1000 + Math.floor(Math.random() * 1000);
      await this.logInfo('等待页面稳定', { tabId: tab.id, delay: stabilizeDelay });
      await new Promise(resolve => setTimeout(resolve, stabilizeDelay));

      // 等待 content script 就绪并启动拦截器
      // 注意：waitForContentReady 现在会直接发送 START_API_INTERCEPTOR
      // 不需要再单独调用 startApiInterceptor
      await this.waitForContentReady(tab.id);

      // 主世界桥接脚本已通过 manifest 自动注入
      // 拦截器已在 waitForContentReady 中启动
      await this.logInfo('拦截器已启动（桥接脚本已自动注入）', { tabId: tab.id });

      // 等待拦截结果（60 秒）
      const result = await this.waitForApiCollection(tab.id, maxCount, 60000);

      await this.stopApiInterceptor(tab.id);

      // 清理状态
      this.activeTab = null;

      if (result.success && result.data?.length) {
        console.log('[Collection Manager] 采集成功，共', result.data.length, '条');

        // 使用去重方法保存数据
        const saveResult = await this.saveBacklinksToStorage(result.data);
        console.log('[Collection Manager] 保存结果 - 新增:', saveResult.saved, '跳过:', saveResult.skipped);

        const libraryResult = await this.addToManagedBacklinkLibrary(result.data, targetGroupId);

        // 保存批次信息
        await collectionBatchStorage.add({
          id: this.currentBatchId!,
          source_platform: SourcePlatform.AHREFS,
          count: saveResult.saved,
          collected_at: new Date().toISOString(),
          sync_status: 'pending',
          synced_count: 0,
        });

        const successResult = {
          success: true,
          count: saveResult.saved,
          addedToLibrary: libraryResult.added,
          skippedInLibrary: libraryResult.skipped,
          groupId: libraryResult.groupId,
        };

        // 调用完成回调
        callbacks?.onCollectionComplete?.(successResult);

        return successResult;
      } else {
        await this.logWarn('采集结束但无有效数据', { error: result.error });
        const failResult = {
          success: false,
          error: result.error || '未找到可采集的外链',
          debugLogs: await this.getDebugLogStrings(30),
        };

        // 调用错误回调
        if (result.error) {
          callbacks?.onCollectionError?.(new Error(result.error));
        }

        return failResult;
      }
    } catch (error) {
      await this.logError('手动采集失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.activeTab = null;

      // 调用错误回调
      if (error instanceof Error) {
        callbacks?.onCollectionError?.(error);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : '采集失败',
        debugLogs: await this.getDebugLogStrings(30),
      };
    } finally {
      if (tabId && shouldCloseTab) {
        unbindCollectionTab(tabId);
        await chrome.tabs.remove(tabId).catch(err => {
          console.warn('[Collection Manager] 关闭采集标签页失败:', err);
        });
      } else if (tabId) {
        unbindCollectionTab(tabId);
        await this.logInfo('保留标签页以供复用', { tabId });
      }
    }
  }

  /**
   * 等待标签页加载完成
   */
  private waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let isResolved = false;

      const cleanup = () => {
        if (!isResolved) {
          isResolved = true;
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
        }
      };

      const timeout = setTimeout(async () => {
        cleanup();

        // 停止页面加载并关闭标签页
        try {
          await chrome.tabs.update(tabId, { url: 'about:blank' });
          await new Promise(resolve => setTimeout(resolve, 100));
          await chrome.tabs.remove(tabId);
          await this.logWarn('页面加载超时，已停止并关闭标签页', { tabId });
        } catch (e) {
          // 标签页可能已关闭
          await this.logWarn('清理超时标签页失败（可能已关闭）', {
            tabId,
            error: e instanceof Error ? e.message : String(e)
          });
        }

        reject(new Error('页面加载超时'));
      }, 60000);

      const listener = (id: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
        if (id === tabId) {
          void this.logInfo('标签页状态更新', {
            tabId,
            status: changeInfo.status,
            url: tab.url?.substring(0, 100)
          });
          if (changeInfo.status === 'complete') {
            cleanup();
            resolve();
          }
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // 检查标签页是否已经加载完成
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') {
          cleanup();
          resolve();
        }
      }).catch(() => {
        cleanup();
        reject(new Error('标签页不存在'));
      });
    });
  }

  private async ensureContentScript(tabId: number): Promise<void> {
    await this.logInfo('尝试注入 content script', { tabId });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/all.iife.js'],
    });
    await this.logInfo('content script 注入完成', { tabId });

    // 等待 content script 初始化完成（避免注入后立即通信导致连接失败）
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.logInfo('content script 已等待初始化', { tabId });
  }

  private async ensureMainWorldBridge(tabId: number): Promise<void> {
    // 主世界桥接脚本已通过 manifest 自动注入 (ahrefs-main-bridge.js)
    // 不需要手动注入，直接返回
    await this.logInfo('确认主世界桥接脚本已就绪', { tabId });
    return Promise.resolve();
  }

  async ensureAhrefsMainWorldBridge(tabId: number): Promise<void> {
    await this.ensureMainWorldBridge(tabId);
  }

  private isReceivingEndMissingError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return error.message.includes('Receiving end does not exist');
  }

  private async sendMessageToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
    const maxAttempts = 6; // 进一步增加重试次数
    let lastError: unknown = null;
    let scriptInjected = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // 先检查标签页是否存在
        const tab = await chrome.tabs.get(tabId);
        if (!tab) {
          throw new Error('标签页不存在');
        }

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

        // 只注入一次
        if (!scriptInjected) {
          await this.logWarn('未找到消息接收端，尝试注入脚本', {
            tabId,
            attempt,
            type: this.extractMessageType(message),
          });
          try {
            await this.ensureContentScript(tabId);
            scriptInjected = true;
          } catch (injectError) {
            await this.logError('注入脚本失败', {
              tabId,
              error: injectError instanceof Error ? injectError.message : String(injectError),
            });
            throw injectError;
          }
        }

        // 指数退避（增加等待时间让 content script 初始化）
        // 第一次等待 1s, 第二次 2s, 第三次 3s, 第四次 4s, 第五次 5s
        const delay = attempt * 1000;
        await this.logWarn('等待 content script 初始化', { tabId, attempt, delay });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `无法连接到内容脚本（${maxAttempts} 次重试后仍失败）：${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  private async waitForContentReady(tabId: number): Promise<void> {
    // 关键修改：不再等待 PING 成功，而是直接尝试发送 START_API_INTERCEPTOR
    // 因为 manifest 已配置 ahrefs-main-bridge.js 在 document_start 注入
    // 桥接脚本已经在页面加载时启动了拦截并 buffer 了数据
    // 我们只需要尽快发送消息让 content script 启动拦截器

    await this.logInfo('尝试直接启动拦截器（跳过 PING 检查）', { tabId });

    // 直接尝试发送 START_API_INTERCEPTOR，如果失败会重试
    const response = await this.sendMessageToTab<{ success?: boolean; error?: string }>(tabId, {
      type: 'START_API_INTERCEPTOR',
      payload: { maxCount: this.activeTab?.maxCount ?? 20 },
    }).catch(error => {
      // 如果发送失败，记录错误但继续尝试
      this.logWarn('首次发送失败，将重试', {
        tabId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

    if (response?.success) {
      await this.logInfo('拦截器启动成功', { tabId });
      return;
    }

    // 如果直接发送失败，抛出错误
    throw new Error(response?.error || '无法启动拦截器');
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
        // 诊断日志：打印收到的消息
        console.log('[Collection Manager] 收到消息:', message.type, {
          expectedTabId: tabId,
          actualTabId: sender.tab?.id,
          hasTab: !!sender.tab,
          hasPayload: !!message.payload,
        });

        if (sender.tab?.id !== tabId) {
          console.log('[Collection Manager] Tab ID 不匹配，跳过处理');
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
      url: backlink.referring_page_url,
      domain: backlink.referring_domain,
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
   * 保存外链到存储（带去重）
   */
  async saveBacklinksToStorage(backlinks: CollectedBacklink[]): Promise<{ saved: number; skipped: number }> {
    console.log('[Collection Manager] 开始保存外链，总数:', backlinks.length);

    // 使用缓存获取现有的 URL 和域名
    const { urls: existingUrls, domains: existingDomains } = await this.getUrlCache();

    console.log('[Collection Manager] 现有 URL 缓存数量:', existingUrls.size);
    console.log('[Collection Manager] 现有域名缓存数量:', existingDomains.size);

    // 过滤重复的外链
    const newBacklinks = backlinks.filter(backlink => {
      const normalizedUrl = this.normalizeUrl(backlink.referring_page_url);
      const domain = backlink.referring_domain.toLowerCase();

      // URL 级别去重
      if (existingUrls.has(normalizedUrl)) {
        console.log('[Collection Manager] URL 已存在，跳过:', normalizedUrl);
        return false;
      }

      return true;
    });

    console.log('[Collection Manager] 去重后新外链数量:', newBacklinks.length);

    if (newBacklinks.length === 0) {
      return { saved: 0, skipped: backlinks.length };
    }

    // 转换为 Opportunity 并保存
    const opportunities = this.convertToOpportunities(newBacklinks);
    await opportunityStorage.addBatch(opportunities);

    // 更新缓存
    for (const opp of opportunities) {
      existingUrls.add(this.normalizeUrl(opp.url));
      existingDomains.add(opp.domain.toLowerCase());
    }

    console.log('[Collection Manager] 保存完成，新增:', opportunities.length, '条');

    return {
      saved: opportunities.length,
      skipped: backlinks.length - newBacklinks.length,
    };
  }

  private normalizeUrl(value: string): string {
    return value.trim().replace(/\/+$/, '').toLowerCase();
  }

  private extractDomain(value: string): string | null {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private async addToManagedBacklinkLibrary(
    backlinks: CollectedBacklink[],
    preferredGroupId?: string,
  ): Promise<{ added: number; skipped: number; groupId: string }> {
    const [groups, existingBacklinks] = await Promise.all([
      managedBacklinkStorage.getAllGroups(),
      managedBacklinkStorage.getAllBacklinks(),
    ]);
    const groupId = groups.some(group => group.id === preferredGroupId) ? (preferredGroupId as string) : 'default';
    const existingUrls = new Set(
      existingBacklinks
        .filter(backlink => backlink.group_id === groupId)
        .map(backlink => this.normalizeUrl(backlink.url)),
    );

    const managedBacklinksToAdd: ManagedBacklink[] = [];
    let skipped = 0;

    for (const backlink of backlinks) {
      const url = backlink.referring_page_url?.trim();
      const domain = backlink.referring_domain?.trim().toLowerCase() || (url ? this.extractDomain(url) : null);

      if (!url || !domain) {
        skipped++;
        continue;
      }

      const normalizedUrl = this.normalizeUrl(url);
      if (existingUrls.has(normalizedUrl)) {
        skipped++;
        continue;
      }

      const now = new Date().toISOString();
      managedBacklinksToAdd.push({
        id: crypto.randomUUID(),
        group_id: groupId,
        url,
        domain,
        note: backlink.page_title?.trim() || undefined,
        keywords: backlink.anchor_text?.trim() ? [backlink.anchor_text.trim()] : [],
        dr: typeof backlink.raw_metrics?.domain_rating === 'number' ? backlink.raw_metrics.domain_rating : undefined,
        as: undefined,
        flagged: false,
        created_at: now,
        updated_at: now,
      });

      existingUrls.add(normalizedUrl);
    }

    for (const backlink of managedBacklinksToAdd) {
      await managedBacklinkStorage.addBacklink(backlink);
    }

    return {
      added: managedBacklinksToAdd.length,
      skipped,
      groupId,
    };
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
export const collectionManager = new CollectionManager();
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
  const { targetUrl, groupId, maxCount, collectionUrlOverride } = message.payload ?? {};
  if (typeof targetUrl !== 'string' || !targetUrl.trim()) {
    sendResponse({
      success: false,
      error: '缺少 targetUrl',
    });
    return false;
  }
  const normalizedMaxCount = Number(maxCount);
  const finalMaxCount =
    Number.isFinite(normalizedMaxCount) && normalizedMaxCount > 0 ? Math.min(100, Math.floor(normalizedMaxCount)) : 20;
  let finalCollectionUrlOverride: string | undefined;
  if (typeof collectionUrlOverride === 'string' && collectionUrlOverride.trim()) {
    try {
      const parsed = new URL(collectionUrlOverride.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        finalCollectionUrlOverride = parsed.toString();
      } else {
        sendResponse({
          success: false,
          error: 'collectionUrlOverride 仅支持 http/https',
        });
        return false;
      }
    } catch {
      sendResponse({
        success: false,
        error: 'collectionUrlOverride 不是有效 URL',
      });
      return false;
    }
  }
  console.log('[Collection Manager] 开始手动采集:', targetUrl);

  collectionManager
    .startManualCollection(targetUrl, finalMaxCount, groupId, finalCollectionUrlOverride)
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

// 注册自动采集完成消息处理器
messageRouter.register('AUTO_COLLECTION_COMPLETE', (message, sender, sendResponse) => {
  const { backlinks } = message.payload || {};
  const tabId = sender.tab?.id;

  console.log('[Collection Manager] 收到自动采集数据:', backlinks?.length || 0, '条，来自标签页:', tabId);

  if (!backlinks || !Array.isArray(backlinks) || backlinks.length === 0) {
    console.warn('[Collection Manager] 自动采集数据为空');
    sendResponse({ success: false, error: '数据为空' });
    return false;
  }

  // 直接保存数据到 opportunityStorage
  collectionManager
    .saveBacklinksToStorage(backlinks)
    .then(result => {
      console.log('[Collection Manager] 自动采集数据已保存 - 新增:', result.saved, '跳过:', result.skipped);
      sendResponse({
        success: true,
        count: backlinks.length,
        saved: result.saved,
        skipped: result.skipped
      });
    })
    .catch(error => {
      console.error('[Collection Manager] 保存自动采集数据失败:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : '保存失败' });
    });

  return true; // 异步响应
});

console.log('[Collection Manager] Collection manager loaded');
