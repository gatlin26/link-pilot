/**
 * Ahrefs API 拦截器
 * 监听和拦截 Ahrefs 页面的网络请求，提取外链数据
 */

import { getAhrefsTargetUrl } from './ahrefs-detector';
import { parseAhrefsApiResponse } from './ahrefs-parser';
import type { CollectedBacklink } from '@extension/shared/lib/types/models';

const BRIDGE_CHANNEL = '__LINK_PILOT_AHREFS_BRIDGE__';
const BRIDGE_SOURCE_MAIN = 'link_pilot_ahrefs_main';
const BRIDGE_SOURCE_CONTENT = 'link_pilot_ahrefs_content';

interface BridgeMessage {
  channel: string;
  source: string;
  type: string;
  payload?: {
    url?: string;
    matched?: boolean;
    transport?: string;
    data?: unknown;
    error?: string;
    maxCount?: number;
    ready?: boolean;
    [key: string]: unknown;
  };
}

/**
 * API 拦截器配置
 */
interface InterceptorConfig {
  /** 最大收集数量 */
  maxCount: number;
  /** 收集完成回调 */
  onCollected: (backlinks: CollectedBacklink[]) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * Ahrefs API 拦截器类
 */
export class AhrefsApiInterceptor {
  private config: InterceptorConfig;
  private collectedBacklinks: CollectedBacklink[] = [];
  private batchId: string;
  private isActive = false;
  private statusCheckInterval: number | null = null;
  private requestCount = 0; // 记录拦截到的请求总数
  private matchedRequestCount = 0; // 记录匹配的请求数
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private processedUrls = new Set<string>(); // 请求去重机制
  private lastStatusLogTime = 0; // 上次日志时间

  constructor(config: InterceptorConfig) {
    this.config = config;
    this.batchId = this.generateBatchId();
  }

  /**
   * 开始拦截
   */
  start(): void {
    if (this.isActive) {
      console.warn('[Ahrefs Interceptor] 拦截器已在运行');
      return;
    }

    this.isActive = true;
    this.collectedBacklinks = [];
    this.batchId = this.generateBatchId();
    this.requestCount = 0;
    this.matchedRequestCount = 0;
    this.processedUrls.clear(); // 清空请求去重集合
    this.lastStatusLogTime = Date.now();

    console.log('[Ahrefs Interceptor] 开始拦截 API 请求');
    console.log('[Ahrefs Interceptor] 目标采集数量:', this.config.maxCount);

    this.bindBridgeListener();
    this.postBridgeCommand('START_INTERCEPT', {
      maxCount: this.config.maxCount,
    });

    // 启动状态检查（改为静默模式，减少日志输出）
    this.statusCheckInterval = window.setInterval(() => {
      const now = Date.now();
      // 只在有进展时才输出日志
      const hasProgress = this.requestCount > 0 || this.collectedBacklinks.length > 0;
      const timeSinceLastLog = now - this.lastStatusLogTime;

      if (hasProgress || timeSinceLastLog > 30000) {
        console.log(
          `[Ahrefs Interceptor] 状态 - 请求: ${this.requestCount}, 匹配: ${this.matchedRequestCount}, 已收集: ${this.collectedBacklinks.length}/${this.config.maxCount}`,
        );
        this.lastStatusLogTime = now;
      }

      // 如果30秒内没有任何请求，给出警告（但只输出一次）
      if (this.requestCount === 0 && timeSinceLastLog > 30000) {
        console.warn('[Ahrefs Interceptor] 警告：拦截器未捕获到网络请求');
      }
    }, 10000);
  }

  /**
   * 停止拦截
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.processedUrls.clear(); // 清空请求去重集合

    // 清除状态检查定时器
    if (this.statusCheckInterval !== null) {
      window.clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    this.postBridgeCommand('STOP_INTERCEPT');
    this.unbindBridgeListener();

    console.log('[Ahrefs Interceptor] 停止拦截');
  }

  private bindBridgeListener(): void {
    if (this.messageListener) {
      return;
    }

    this.messageListener = (event: MessageEvent) => {
      const data = event.data as BridgeMessage | undefined;
      if (event.source !== window || !data || typeof data !== 'object') {
        return;
      }
      if (data.channel !== BRIDGE_CHANNEL || data.source !== BRIDGE_SOURCE_MAIN) {
        return;
      }
      if (!this.isActive) {
        return;
      }

      switch (data.type) {
        case 'BRIDGE_READY': {
          // 静默处理，不输出日志
          return;
        }

        case 'REQUEST_SEEN': {
          const requestUrl = typeof data.payload?.url === 'string' ? data.payload.url : '';
          if (!requestUrl) {
            return;
          }

          // 请求去重：同一 URL 只处理一次
          if (this.processedUrls.has(requestUrl)) {
            return;
          }
          this.processedUrls.add(requestUrl);

          this.requestCount++;

          // 减少日志输出：只在首次匹配时输出
          if (data.payload?.matched && this.matchedRequestCount === 0) {
            this.matchedRequestCount++;
            console.log('[Ahrefs Interceptor] 首次匹配 API 请求');
          } else if (data.payload?.matched) {
            this.matchedRequestCount++;
          }
          return;
        }

        case 'API_RESPONSE': {
          const url = typeof data.payload?.url === 'string' ? data.payload.url : '';
          if (!url) {
            return;
          }

          // 响应去重
          if (this.processedUrls.has(url + '_response')) {
            return;
          }
          this.processedUrls.add(url + '_response');

          console.log('[Ahrefs Interceptor] 收到 API 响应');
          this.handleApiResponse(data.payload?.data, url);
          return;
        }

        case 'BRIDGE_ERROR': {
          const errorMessage = typeof data.payload?.error === 'string' ? data.payload.error : '主世界桥接错误';
          console.error('[Ahrefs Interceptor] 桥接错误:', errorMessage);
          if (this.config.onError) {
            this.config.onError(new Error(errorMessage));
          }
          return;
        }

        default:
          return;
      }
    };

    window.addEventListener('message', this.messageListener);
  }

  private unbindBridgeListener(): void {
    if (!this.messageListener) {
      return;
    }
    window.removeEventListener('message', this.messageListener);
    this.messageListener = null;
  }

  private postBridgeCommand(type: string, payload?: Record<string, unknown>): void {
    window.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        source: BRIDGE_SOURCE_CONTENT,
        type,
        payload,
      } satisfies BridgeMessage,
      '*',
    );
  }

  /**
   * 检查 URL 是否匹配任何模式（用于调试）
   */
  private checkUrlPatterns(url: string): { matched: boolean; pattern?: string } {
    const patterns = [
      { name: 'api.ahrefs.com', regex: /api\.ahrefs\.com/i },
      { name: 'ahrefs.com/api', regex: /ahrefs\.com\/api/i },
      { name: 'versioned API', regex: /ahrefs\.com\/v\d+\//i },
      { name: 'stGetFreeBacklinksList', regex: /stGetFreeBacklinksList/i },
      { name: 'backlink api', regex: /backlink.*api/i },
      { name: 'refpages', regex: /refpages/i },
      { name: 'backlinks', regex: /backlinks/i },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(url)) {
        return { matched: true, pattern: pattern.name };
      }
    }

    return { matched: false };
  }

  /**
   * 处理 API 响应
   */
  private handleApiResponse(data: unknown, url: string): void {
    try {
      console.log('[Ahrefs Interceptor] 捕获 API 响应:', url);

      const targetUrl = getAhrefsTargetUrl();
      if (!targetUrl) {
        console.warn('[Ahrefs Interceptor] 无法获取目标 URL');
        return;
      }

      // 解析外链数据
      const backlinks = parseAhrefsApiResponse(data, targetUrl, this.batchId);

      if (backlinks.length > 0) {
        // 添加到收集列表
        this.collectedBacklinks.push(...backlinks);

        console.log(`[Ahrefs Interceptor] 已收集 ${this.collectedBacklinks.length}/${this.config.maxCount} 条外链`);

        // 检查是否达到目标数量
        if (this.collectedBacklinks.length >= this.config.maxCount) {
          console.log('[Ahrefs Interceptor] 达到目标数量，准备完成采集');
          this.complete();
        }
      } else {
        console.log('[Ahrefs Interceptor] 当前响应未解析出外链数据');
      }
    } catch (error) {
      console.error('[Ahrefs Interceptor] 处理 API 响应失败:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }

  /**
   * 完成收集
   */
  private complete(): void {
    // 截取指定数量
    const results = this.collectedBacklinks.slice(0, this.config.maxCount);

    console.log(`[Ahrefs Interceptor] 收集完成，共 ${results.length} 条外链`);

    // 停止拦截
    this.stop();

    // 调用回调
    this.config.onCollected(results);
  }

  /**
   * 生成批次 ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取当前收集的外链数量
   */
  getCollectedCount(): number {
    return this.collectedBacklinks.length;
  }

  /**
   * 获取已收集的外链数据
   */
  getCollectedBacklinks(): CollectedBacklink[] {
    return this.collectedBacklinks.slice();
  }

  /**
   * 获取是否正在运行
   */
  isRunning(): boolean {
    return this.isActive;
  }
}

/**
 * 创建 Ahrefs API 拦截器
 */
export const createAhrefsInterceptor = (config: InterceptorConfig): AhrefsApiInterceptor =>
  new AhrefsApiInterceptor(config);
