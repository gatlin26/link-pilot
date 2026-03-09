/**
 * chrome.webRequest 封装
 * 提供请求监听、URL 过滤、生命周期管理
 * 注意：MV3 下 webRequest 仅可观察，无法读取响应体
 */
import { messageRouter } from './message-router';

/** Ahrefs API URL 匹配模式 */
const AHREFS_API_PATTERNS = [
  '*://api.ahrefs.com/*',
  '*://*.ahrefs.com/api/*',
  '*://*.ahrefs.com/v*/*',
];

/** 请求过滤器 */
const AHREFS_FILTER: chrome.webRequest.RequestFilter = {
  urls: AHREFS_API_PATTERNS,
  types: ['xmlhttprequest'],
};

/** 请求详情（简化） */
export interface WebRequestDetails {
  requestId: string;
  url: string;
  tabId: number;
  type: string;
  method: string;
  timestamp: number;
}

/** 完成详情（含状态码） */
export interface WebRequestCompletedDetails extends WebRequestDetails {
  statusCode: number;
}

/** 监听器配置 */
export interface WebRequestManagerConfig {
  /** 请求即将发出时回调 */
  onBeforeRequest?: (details: WebRequestDetails) => void;
  /** 请求完成时回调 */
  onCompleted?: (details: WebRequestCompletedDetails) => void;
  /** 请求失败时回调 */
  onErrorOccurred?: (details: WebRequestDetails & { error: string }) => void;
}

export type RequestTraceState = 'before' | 'completed' | 'error';

export interface RequestTrace {
  requestId: string;
  tabId: number;
  url: string;
  method: string;
  resourceType: string;
  state: RequestTraceState;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  statusCode?: number;
  error?: string;
  initiator?: string;
  batchId?: string;
  targetUrl?: string;
  orphan?: boolean;
  lastUpdatedAt: number;
}

export interface CollectionTabBinding {
  tabId: number;
  batchId: string;
  targetUrl: string;
  boundAt: number;
}

export interface WebRequestTraceStats {
  counts: {
    before: number;
    completed: number;
    error: number;
    inFlight: number;
    orphan: number;
  };
  recent: RequestTrace[];
  bindings: CollectionTabBinding[];
}

const toDetails = (d: chrome.webRequest.WebRequestBodyDetails | chrome.webRequest.WebRequestDetails): WebRequestDetails => ({
  requestId: d.requestId,
  url: d.url,
  tabId: d.tabId ?? -1,
  type: d.type,
  method: d.method,
  timestamp: d.timeStamp ?? 0,
});

const toTimestamp = (value: number): number => (value > 0 ? value : Date.now());

const getInitiator = (
  d:
    | chrome.webRequest.WebRequestBodyDetails
    | chrome.webRequest.WebRequestDetails
    | chrome.webRequest.WebResponseCacheDetails
    | chrome.webRequest.WebResponseErrorDetails,
): string | undefined => {
  return 'initiator' in d && typeof d.initiator === 'string' ? d.initiator : undefined;
};

/**
 * chrome.webRequest 封装对象
 */
export class WebRequestManager {
  private static readonly MAX_RECENT_TRACES = 100;
  private static readonly MAX_IN_FLIGHT_TRACES = 500;
  private static readonly STALE_IN_FLIGHT_MS = 5 * 60 * 1000;

  private config: WebRequestManagerConfig;
  private beforeRequestListener: ((d: chrome.webRequest.WebRequestBodyDetails) => void) | null = null;
  private completedListener: ((d: chrome.webRequest.WebResponseCacheDetails) => void) | null = null;
  private errorListener: ((d: chrome.webRequest.WebResponseErrorDetails) => void) | null = null;
  private isActive = false;
  private traceIndex: Map<string, RequestTrace> = new Map();
  private recentTraces: RequestTrace[] = [];
  private collectionTabBindings: Map<number, CollectionTabBinding> = new Map();
  private beforeCount = 0;
  private completedCount = 0;
  private errorCount = 0;
  private orphanCount = 0;

  constructor(config: WebRequestManagerConfig = {}) {
    this.config = config;
  }

  /**
   * 启动监听
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.beforeRequestListener = (details: chrome.webRequest.WebRequestBodyDetails) => {
      const normalized = toDetails(details);
      this.handleBeforeRequest(normalized, getInitiator(details));
      this.config.onBeforeRequest?.(normalized);
    };

    this.completedListener = (details: chrome.webRequest.WebResponseCacheDetails) => {
      const normalized = {
        ...toDetails(details),
        statusCode: details.statusCode ?? 0,
      };
      this.handleCompleted(normalized, getInitiator(details));
      this.config.onCompleted?.(normalized);
    };

    this.errorListener = (details: chrome.webRequest.WebResponseErrorDetails) => {
      const normalized = {
        ...toDetails(details),
        error: details.error ?? 'unknown',
      };
      this.handleError(normalized, getInitiator(details));
      this.config.onErrorOccurred?.(normalized);
    };

    chrome.webRequest.onBeforeRequest.addListener(this.beforeRequestListener, AHREFS_FILTER);
    chrome.webRequest.onCompleted.addListener(this.completedListener, AHREFS_FILTER);
    chrome.webRequest.onErrorOccurred.addListener(this.errorListener, AHREFS_FILTER);

    this.isActive = true;
    console.log('[WebRequestManager] 已启动 Ahrefs API 请求监听');
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    if (this.beforeRequestListener) {
      chrome.webRequest.onBeforeRequest.removeListener(this.beforeRequestListener);
      this.beforeRequestListener = null;
    }
    if (this.completedListener) {
      chrome.webRequest.onCompleted.removeListener(this.completedListener);
      this.completedListener = null;
    }
    if (this.errorListener) {
      chrome.webRequest.onErrorOccurred.removeListener(this.errorListener);
      this.errorListener = null;
    }

    this.isActive = false;
    console.log('[WebRequestManager] 已停止监听');
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<WebRequestManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 是否正在运行
   */
  get active(): boolean {
    return this.isActive;
  }

  bindCollectionTab(tabId: number, batchId: string, targetUrl: string): void {
    if (!Number.isInteger(tabId) || tabId < 0) {
      return;
    }
    this.collectionTabBindings.set(tabId, {
      tabId,
      batchId,
      targetUrl,
      boundAt: Date.now(),
    });
  }

  unbindCollectionTab(tabId: number): void {
    if (!Number.isInteger(tabId) || tabId < 0) {
      return;
    }
    this.collectionTabBindings.delete(tabId);
  }

  getStats(limit: number = 20): WebRequestTraceStats {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(200, Math.max(1, Math.floor(limit)))
      : 20;

    return {
      counts: {
        before: this.beforeCount,
        completed: this.completedCount,
        error: this.errorCount,
        inFlight: this.traceIndex.size,
        orphan: this.orphanCount,
      },
      recent: this.recentTraces.slice(-safeLimit).reverse(),
      bindings: Array.from(this.collectionTabBindings.values()),
    };
  }

  /**
   * 刷新 handler 行为（清除缓存影响，慎用，开销大）
   */
  static async handlerBehaviorChanged(): Promise<void> {
    await chrome.webRequest.handlerBehaviorChanged();
  }

  private handleBeforeRequest(details: WebRequestDetails, initiator?: string): void {
    this.beforeCount += 1;
    const timestamp = toTimestamp(details.timestamp);
    const existingTrace = this.traceIndex.get(details.requestId);
    const binding = this.collectionTabBindings.get(details.tabId);

    this.traceIndex.set(details.requestId, {
      requestId: details.requestId,
      tabId: details.tabId,
      url: details.url,
      method: details.method,
      resourceType: details.type,
      state: 'before',
      startedAt: existingTrace ? Math.min(existingTrace.startedAt, timestamp) : timestamp,
      initiator: initiator ?? existingTrace?.initiator,
      batchId: binding?.batchId ?? existingTrace?.batchId,
      targetUrl: binding?.targetUrl ?? existingTrace?.targetUrl,
      orphan: false,
      lastUpdatedAt: timestamp,
    });

    this.pruneInFlight(timestamp);
  }

  private handleCompleted(details: WebRequestCompletedDetails, initiator?: string): void {
    this.completedCount += 1;
    this.finalizeTrace(details, 'completed', {
      statusCode: details.statusCode,
      initiator,
    });
  }

  private handleError(details: WebRequestDetails & { error: string }, initiator?: string): void {
    this.errorCount += 1;
    this.finalizeTrace(details, 'error', {
      error: details.error,
      initiator,
    });
  }

  private finalizeTrace(
    details: WebRequestDetails,
    state: 'completed' | 'error',
    extra: { statusCode?: number; error?: string; initiator?: string },
  ): void {
    const timestamp = toTimestamp(details.timestamp);
    const existingTrace = this.traceIndex.get(details.requestId);
    const orphan = !existingTrace;
    const binding = this.collectionTabBindings.get(details.tabId);
    const startedAt = existingTrace?.startedAt ?? timestamp;

    if (orphan) {
      this.orphanCount += 1;
    }

    const trace: RequestTrace = {
      requestId: details.requestId,
      tabId: details.tabId,
      url: details.url,
      method: details.method,
      resourceType: details.type,
      state,
      startedAt,
      endedAt: timestamp,
      durationMs: Math.max(0, timestamp - startedAt),
      statusCode: state === 'completed' ? extra.statusCode : undefined,
      error: state === 'error' ? extra.error : undefined,
      initiator: extra.initiator ?? existingTrace?.initiator,
      batchId: binding?.batchId ?? existingTrace?.batchId,
      targetUrl: binding?.targetUrl ?? existingTrace?.targetUrl,
      orphan,
      lastUpdatedAt: timestamp,
    };

    this.pushRecentTrace(trace);
    this.traceIndex.delete(details.requestId);
    this.pruneInFlight(timestamp);
  }

  private pushRecentTrace(trace: RequestTrace): void {
    this.recentTraces.push({ ...trace });

    const overflow = this.recentTraces.length - WebRequestManager.MAX_RECENT_TRACES;
    if (overflow > 0) {
      this.recentTraces.splice(0, overflow);
    }
  }

  private pruneInFlight(now: number): void {
    if (!this.traceIndex.size) {
      return;
    }

    for (const [requestId, trace] of this.traceIndex.entries()) {
      if (now - trace.lastUpdatedAt > WebRequestManager.STALE_IN_FLIGHT_MS) {
        this.traceIndex.delete(requestId);
      }
    }

    const overflow = this.traceIndex.size - WebRequestManager.MAX_IN_FLIGHT_TRACES;
    if (overflow <= 0) {
      return;
    }

    const oldestEntries = Array.from(this.traceIndex.entries())
      .sort((a, b) => a[1].lastUpdatedAt - b[1].lastUpdatedAt)
      .slice(0, overflow);

    for (const [requestId] of oldestEntries) {
      this.traceIndex.delete(requestId);
    }
  }
}

/** 单例实例（可选） */
let defaultInstance: WebRequestManager | null = null;

/**
 * 获取默认 WebRequestManager 实例
 */
export function getWebRequestManager(config?: WebRequestManagerConfig): WebRequestManager {
  if (!defaultInstance) {
    defaultInstance = new WebRequestManager(config ?? {});
  }
  if (config) {
    defaultInstance.setConfig(config);
  }
  return defaultInstance;
}

export function bindCollectionTab(tabId: number, batchId: string, targetUrl: string): void {
  getWebRequestManager().bindCollectionTab(tabId, batchId, targetUrl);
}

export function unbindCollectionTab(tabId: number): void {
  getWebRequestManager().unbindCollectionTab(tabId);
}

export function getWebRequestTraceStats(limit?: number): WebRequestTraceStats {
  return getWebRequestManager().getStats(limit);
}

const defaultManager = getWebRequestManager();
defaultManager.start();

messageRouter.register('GET_WEB_REQUEST_TRACE_STATS', (message, _sender, sendResponse) => {
  const requestedLimit = Number(message?.payload?.limit ?? message?.limit);
  const stats = defaultManager.getStats(requestedLimit);
  sendResponse({
    success: true,
    data: stats,
  });
  return false;
});
