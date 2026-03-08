/**
 * Ahrefs API 拦截器
 * 监听和拦截 Ahrefs 页面的网络请求，提取外链数据
 */

import type { CollectedBacklink } from '@extension/shared/lib/types/models';
import { parseAhrefsApiResponse } from './ahrefs-parser';
import { getAhrefsTargetUrl } from './ahrefs-detector';

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
  private originalFetch: typeof fetch;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send;

  constructor(config: InterceptorConfig) {
    this.config = config;
    this.batchId = this.generateBatchId();
    this.originalFetch = window.fetch;
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
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

    console.log('[Ahrefs Interceptor] 开始拦截 API 请求');

    // 拦截 fetch
    this.interceptFetch();

    // 拦截 XMLHttpRequest
    this.interceptXHR();
  }

  /**
   * 停止拦截
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // 恢复原始方法
    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXhrOpen;
    XMLHttpRequest.prototype.send = this.originalXhrSend;

    console.log('[Ahrefs Interceptor] 停止拦截');
  }

  /**
   * 拦截 fetch 请求
   */
  private interceptFetch(): void {
    const self = this;

    window.fetch = async function(...args): Promise<Response> {
      const [resource] = args;
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.toString() : resource.url;

      // 调用原始 fetch
      const response = await self.originalFetch.call(window, ...args);

      // 检查是否为 Ahrefs API 请求
      if (self.isActive && self.isAhrefsApiRequest(url)) {
        console.log('[Ahrefs Interceptor] 命中 fetch API 请求:', url);
        // 克隆响应以便读取
        const clonedResponse = response.clone();

        try {
          const data = await clonedResponse.json();
          self.handleApiResponse(data, url);
        } catch (error) {
          console.error('[Ahrefs Interceptor] 解析 fetch 响应失败:', error);
        }
      }

      return response;
    };
  }

  /**
   * 拦截 XMLHttpRequest
   */
  private interceptXHR(): void {
    const self = this;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: unknown[]): void {
      // 保存 URL 到实例
      (this as XMLHttpRequest & { _url?: string })._url = url.toString();
      return self.originalXhrOpen.apply(this, [method, url, ...rest] as Parameters<typeof XMLHttpRequest.prototype.open>);
    };

    XMLHttpRequest.prototype.send = function(...args): void {
      const xhr = this;
      const url = (xhr as XMLHttpRequest & { _url?: string })._url || '';

      // 添加响应监听
      if (self.isActive && self.isAhrefsApiRequest(url)) {
        console.log('[Ahrefs Interceptor] 命中 XHR API 请求:', url);
        xhr.addEventListener('load', function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              self.handleApiResponse(data, url);
            } catch (error) {
              console.error('[Ahrefs Interceptor] 解析 XHR 响应失败:', error);
            }
          }
        });
      }

      self.originalXhrSend.apply(this, args as Parameters<typeof XMLHttpRequest.prototype.send>);
    };
  }

  /**
   * 判断是否为 Ahrefs API 请求
   */
  private isAhrefsApiRequest(url: string): boolean {
    // Ahrefs API 请求特征
    const patterns = [
      /api\.ahrefs\.com/i,
      /ahrefs\.com\/api/i,
      /backlink.*api/i,
      /refpages/i,
      /backlinks/i,
    ];

    return patterns.some(pattern => pattern.test(url));
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
export function createAhrefsInterceptor(config: InterceptorConfig): AhrefsApiInterceptor {
  return new AhrefsApiInterceptor(config);
}
