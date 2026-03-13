/**
 * 性能监控工具
 * 监控表单检测、字段分析和填充操作的性能指标
 *
 * @author yiangto
 * @date 2026-03-13
 */

import { logger } from '@extension/shared';

/** 性能指标类型 */
export enum MetricType {
  /** 表单检测耗时 */
  FORM_DETECTION = 'form_detection',
  /** 字段分析耗时 */
  FIELD_ANALYSIS = 'field_analysis',
  /** 字段填充耗时 */
  FIELD_FILLING = 'field_filling',
  /** Shadow DOM 检测耗时 */
  SHADOW_DOM_DETECTION = 'shadow_dom_detection',
  /** 内存占用 */
  MEMORY_USAGE = 'memory_usage',
}

/** 性能指标记录 */
interface PerformanceMetric {
  /** 指标类型 */
  type: MetricType;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 耗时（毫秒） */
  duration?: number;
  /** 额外信息 */
  metadata?: Record<string, any>;
}

/** 性能统计 */
interface PerformanceStats {
  /** 总次数 */
  count: number;
  /** 总耗时 */
  totalDuration: number;
  /** 平均耗时 */
  avgDuration: number;
  /** 最小耗时 */
  minDuration: number;
  /** 最大耗时 */
  maxDuration: number;
}

/**
 * 性能监控器类
 */
class PerformanceMonitor {
  /** 性能指标记录 */
  private metrics: Map<string, PerformanceMetric> = new Map();

  /** 已完成的指标历史 */
  private history: PerformanceMetric[] = [];

  /** 最大历史记录数 */
  private maxHistorySize = 100;

  /** 是否启用监控 */
  private enabled = true;

  /**
   * 启用监控
   */
  enable(): void {
    this.enabled = true;
    logger.info('性能监控已启用');
  }

  /**
   * 禁用监控
   */
  disable(): void {
    this.enabled = false;
    logger.info('性能监控已禁用');
  }

  /**
   * 开始监控
   */
  start(type: MetricType, id?: string, metadata?: Record<string, any>): string {
    if (!this.enabled) {
      return '';
    }

    const metricId = id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const metric: PerformanceMetric = {
      type,
      startTime: performance.now(),
      metadata,
    };

    this.metrics.set(metricId, metric);

    logger.debug(`性能监控开始: ${type}`, { id: metricId, metadata });

    return metricId;
  }

  /**
   * 结束监控
   */
  end(id: string): number | null {
    if (!this.enabled || !id) {
      return null;
    }

    const metric = this.metrics.get(id);
    if (!metric) {
      logger.warn(`性能监控记录不存在: ${id}`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // 移到历史记录
    this.history.push(metric);
    this.metrics.delete(id);

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // 定期清理历史记录（每100条记录清理一次）
    if (this.history.length > 100) {
      this.autoCleanHistory();
    }

    logger.debug(`性能监控结束: ${metric.type}`, {
      id,
      duration: `${metric.duration.toFixed(2)}ms`,
      metadata: metric.metadata,
    });

    // 如果耗时过长，发出警告
    if (metric.duration > 1000) {
      logger.warn(`性能警告: ${metric.type} 耗时过长`, {
        duration: `${metric.duration.toFixed(2)}ms`,
        metadata: metric.metadata,
      });
    }

    return metric.duration;
  }

  /**
   * 自动清理历史记录
   * 删除超过 5 分钟的旧记录
   */
  private autoCleanHistory(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟
    this.history = this.history.filter(m => now - m.startTime < maxAge);
  }

  /**
   * 测量函数执行时间
   */
  async measure<T>(
    type: MetricType,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const id = this.start(type, undefined, metadata);

    try {
      const result = await fn();
      this.end(id);
      return result;
    } catch (error) {
      this.end(id);
      throw error;
    }
  }

  /**
   * 获取指定类型的统计信息
   */
  getStats(type: MetricType): PerformanceStats | null {
    const typeMetrics = this.history.filter(m => m.type === type && m.duration !== undefined);

    if (typeMetrics.length === 0) {
      return null;
    }

    const durations = typeMetrics.map(m => m.duration!);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      count: typeMetrics.length,
      totalDuration,
      avgDuration: totalDuration / typeMetrics.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
    };
  }

  /**
   * 获取所有类型的统计信息
   */
  getAllStats(): Map<MetricType, PerformanceStats> {
    const stats = new Map<MetricType, PerformanceStats>();

    for (const type of Object.values(MetricType)) {
      const stat = this.getStats(type as MetricType);
      if (stat) {
        stats.set(type as MetricType, stat);
      }
    }

    return stats;
  }

  /**
   * 监控内存使用情况
   */
  measureMemory(): void {
    if (!this.enabled) {
      return;
    }

    // 检查是否支持 performance.memory
    if ('memory' in performance) {
      const memory = (performance as any).memory;

      const metric: PerformanceMetric = {
        type: MetricType.MEMORY_USAGE,
        startTime: performance.now(),
        endTime: performance.now(),
        duration: 0,
        metadata: {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usedMB: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
          totalMB: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
        },
      };

      this.history.push(metric);

      logger.debug('内存使用情况', metric.metadata);

      // 如果内存使用超过 80%，发出警告
      const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (usagePercent > 80 && metric.metadata) {
        logger.warn('内存使用率过高', {
          usagePercent: `${usagePercent.toFixed(2)}%`,
          usedMB: metric.metadata.usedMB,
        });
      }
    } else {
      logger.debug('当前浏览器不支持 performance.memory API');
    }
  }

  /**
   * 获取历史记录
   */
  getHistory(type?: MetricType): PerformanceMetric[] {
    if (type) {
      return this.history.filter(m => m.type === type);
    }
    return [...this.history];
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history = [];
    logger.info('性能监控历史已清空');
  }

  /**
   * 清理资源
   * 清空所有指标和历史记录
   */
  clear(): void {
    this.metrics.clear();
    this.history = [];
  }

  /**
   * 生成性能报告
   */
  generateReport(): string {
    const stats = this.getAllStats();
    const lines: string[] = [];

    lines.push('=== 性能监控报告 ===');
    lines.push('');

    for (const [type, stat] of stats.entries()) {
      lines.push(`${type}:`);
      lines.push(`  次数: ${stat.count}`);
      lines.push(`  平均耗时: ${stat.avgDuration.toFixed(2)}ms`);
      lines.push(`  最小耗时: ${stat.minDuration.toFixed(2)}ms`);
      lines.push(`  最大耗时: ${stat.maxDuration.toFixed(2)}ms`);
      lines.push(`  总耗时: ${stat.totalDuration.toFixed(2)}ms`);
      lines.push('');
    }

    // 添加内存信息
    const memoryMetrics = this.history.filter(m => m.type === MetricType.MEMORY_USAGE);
    if (memoryMetrics.length > 0) {
      const latest = memoryMetrics[memoryMetrics.length - 1];
      if (latest.metadata) {
        lines.push('内存使用情况:');
        lines.push(`  已使用: ${latest.metadata.usedMB}MB`);
        lines.push(`  总计: ${latest.metadata.totalMB}MB`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.metrics.clear();
    this.history = [];
    this.enabled = false;
    logger.info('性能监控器已销毁');
  }
}

/**
 * 默认性能监控实例
 */
export const performanceMonitor = new PerformanceMonitor();
