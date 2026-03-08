/**
 * Ahrefs 收集器使用示例
 */

import { collectorRegistry } from './collectors';

/**
 * 初始化收集器
 */
export function initCollector(): void {
  console.log('[Collector] 初始化收集器');

  // 检测当前页面是否支持收集
  const collector = collectorRegistry.detectCollector();
  if (collector) {
    console.log(`[Collector] 当前页面支持 ${collector.platform} 平台数据收集`);
  } else {
    console.log('[Collector] 当前页面不支持数据收集');
  }
}

/**
 * 开始收集外链数据
 * @param maxCount 最大收集数量（10 或 20）
 */
export async function startCollection(maxCount: number = 10): Promise<void> {
  try {
    console.log(`[Collector] 开始收集 ${maxCount} 条外链数据`);

    const backlinks = await collectorRegistry.startCollection(maxCount);

    console.log(`[Collector] 收集成功，共 ${backlinks.length} 条外链`);
    console.log('[Collector] 外链数据:', backlinks);

    // TODO: 将数据保存到本地存储或发送到后端
    // 例如：await saveBacklinksToStorage(backlinks);

  } catch (error) {
    console.error('[Collector] 收集失败:', error);
    throw error;
  }
}

/**
 * 停止收集
 */
export function stopCollection(): void {
  collectorRegistry.stopCollection();
  console.log('[Collector] 已停止收集');
}

/**
 * 获取收集进度
 */
export function getCollectionProgress(): { current: number; target: number } | null {
  return collectorRegistry.getProgress();
}

/**
 * 检查是否正在收集
 */
export function isCollecting(): boolean {
  return collectorRegistry.isCollecting();
}

// 页面加载时初始化
if (typeof window !== 'undefined') {
  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollector);
  } else {
    initCollector();
  }
}
