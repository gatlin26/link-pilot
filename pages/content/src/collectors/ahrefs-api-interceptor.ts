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

    console.log('[Ahrefs Interceptor] 开始拦截 API 请求');
    console.log('[Ahrefs Interceptor] 当前页面 URL:', window.location.href);
    console.log('[Ahrefs Interceptor] 目标采集数量:', this.config.maxCount);

    this.bindBridgeListener();
    this.postBridgeCommand('START_INTERCEPT', {
      maxCount: this.config.maxCount,
    });

    console.log('[Ahrefs Interceptor] 拦截器已激活，等待网络请求...');

    // 启动状态检查（每10秒报告一次）
    this.statusCheckInterval = window.setInterval(() => {
      console.log(
        `[Ahrefs Interceptor] 状态检查 - 总请求: ${this.requestCount}, 匹配请求: ${this.matchedRequestCount}, 已收集: ${this.collectedBacklinks.length}/${this.config.maxCount}`,
      );

      // 如果60秒内没有任何请求，给出警告
      if (this.requestCount === 0) {
        console.warn('[Ahrefs Interceptor] ⚠️ 警告：拦截器已启动但未捕获到任何网络请求！');
        console.warn('[Ahrefs Interceptor] 可能原因：');
        console.warn('[Ahrefs Interceptor] 1. 页面在拦截器启动前已完成所有请求');
        console.warn('[Ahrefs Interceptor] 2. Ahrefs 使用了其他请求方式（如 iframe、WebSocket）');
        console.warn('[Ahrefs Interceptor] 3. Content script 注入时机有问题');
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
          console.log('[Ahrefs Interceptor] 主世界桥接已就绪');
          return;
        }

        case 'REQUEST_SEEN': {
          const requestUrl = typeof data.payload?.url === 'string' ? data.payload.url : '';
          if (!requestUrl) {
            return;
          }
          this.requestCount++;
          console.log(
            `[Ahrefs Interceptor] ${data.payload?.transport || 'request'} 请求 #${this.requestCount}:`,
            requestUrl,
          );
          if (data.payload?.matched) {
            this.matchedRequestCount++;
            const matchResult = this.checkUrlPatterns(requestUrl);
            if (matchResult.matched) {
              console.log('[Ahrefs Interceptor] ✓ URL 匹配模式:', matchResult.pattern);
            }
          }
          return;
        }

        case 'API_RESPONSE': {
          const url = typeof data.payload?.url === 'string' ? data.payload.url : '';
          if (!url) {
            return;
          }
          console.log('[Ahrefs Interceptor] ✓ 命中 API 请求:', url);
          const responseData = data.payload?.data;
          if (responseData && typeof responseData === 'object') {
            console.log('[Ahrefs Interceptor] 响应数据结构:', Object.keys(responseData as Record<string, unknown>));
          }
          this.handleApiResponse(responseData, url);
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
