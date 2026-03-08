/**
 * 收集器注册表
 * 管理不同平台的数据收集器
 */

import type { CollectedBacklink } from '@extension/shared/lib/types/models';
import { SourcePlatform } from '@extension/shared/lib/types/enums';
import { isAhrefsBacklinkChecker } from './ahrefs-detector';
import { createAhrefsInterceptor, type AhrefsApiInterceptor } from './ahrefs-api-interceptor';

/**
 * 收集器接口
 */
export interface Collector {
  /** 平台名称 */
  platform: SourcePlatform;
  /** 检测是否支持当前页面 */
  detect: () => boolean;
  /** 开始收集 */
  start: (maxCount: number) => Promise<CollectedBacklink[]>;
  /** 停止收集 */
  stop: () => void;
  /** 获取收集进度 */
  getProgress: () => { current: number; target: number };
}

/**
 * Ahrefs 收集器
 */
class AhrefsCollector implements Collector {
  platform = SourcePlatform.AHREFS;
  private interceptor: AhrefsApiInterceptor | null = null;
  private targetCount = 0;

  detect(): boolean {
    return isAhrefsBacklinkChecker();
  }

  async start(maxCount: number): Promise<CollectedBacklink[]> {
    this.targetCount = maxCount;

    return new Promise((resolve, reject) => {
      // 创建拦截器
      this.interceptor = createAhrefsInterceptor({
        maxCount,
        onCollected: (backlinks) => {
          resolve(backlinks);
        },
        onError: (error) => {
          reject(error);
        },
      });

      // 开始拦截
      this.interceptor.start();

      console.log(`[Ahrefs Collector] 开始收集，目标数量: ${maxCount}`);

      // 设置超时（60秒）
      setTimeout(() => {
        if (this.interceptor?.isRunning()) {
          const collected = this.interceptor.getCollectedCount();
          console.warn(`[Ahrefs Collector] 收集超时，已收集 ${collected} 条`);
          this.stop();
          reject(new Error(`收集超时，仅收集到 ${collected} 条数据`));
        }
      }, 60000);
    });
  }

  stop(): void {
    if (this.interceptor) {
      this.interceptor.stop();
      this.interceptor = null;
    }
  }

  getProgress(): { current: number; target: number } {
    return {
      current: this.interceptor?.getCollectedCount() || 0,
      target: this.targetCount,
    };
  }
}

/**
 * 收集器注册表
 */
export class CollectorRegistry {
  private collectors: Map<SourcePlatform, Collector> = new Map();
  private activeCollector: Collector | null = null;

  constructor() {
    // 注册 Ahrefs 收集器
    this.register(new AhrefsCollector());
  }

  /**
   * 注册收集器
   */
  register(collector: Collector): void {
    this.collectors.set(collector.platform, collector);
    console.log(`[Collector Registry] 注册收集器: ${collector.platform}`);
  }

  /**
   * 检测当前页面支持的收集器
   */
  detectCollector(): Collector | null {
    for (const collector of this.collectors.values()) {
      if (collector.detect()) {
        console.log(`[Collector Registry] 检测到支持的平台: ${collector.platform}`);
        return collector;
      }
    }
    return null;
  }

  /**
   * 开始收集
   */
  async startCollection(maxCount: number = 10): Promise<CollectedBacklink[]> {
    // 检测收集器
    const collector = this.detectCollector();
    if (!collector) {
      throw new Error('当前页面不支持数据收集');
    }

    // 停止之前的收集
    if (this.activeCollector) {
      this.activeCollector.stop();
    }

    this.activeCollector = collector;

    try {
      const backlinks = await collector.start(maxCount);
      console.log(`[Collector Registry] 收集完成，共 ${backlinks.length} 条外链`);
      return backlinks;
    } catch (error) {
      console.error('[Collector Registry] 收集失败:', error);
      throw error;
    } finally {
      this.activeCollector = null;
    }
  }

  /**
   * 停止收集
   */
  stopCollection(): void {
    if (this.activeCollector) {
      this.activeCollector.stop();
      this.activeCollector = null;
      console.log('[Collector Registry] 已停止收集');
    }
  }

  /**
   * 获取收集进度
   */
  getProgress(): { current: number; target: number } | null {
    if (this.activeCollector) {
      return this.activeCollector.getProgress();
    }
    return null;
  }

  /**
   * 检查是否正在收集
   */
  isCollecting(): boolean {
    return this.activeCollector !== null;
  }
}

/**
 * 全局收集器注册表实例
 */
export const collectorRegistry = new CollectorRegistry();
