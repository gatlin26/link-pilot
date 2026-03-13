/**
 * 递归队列存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { RecursiveQueueItem } from '@extension/shared';
import { RecursiveQueueStatus } from '@extension/shared';

export interface RecursiveQueueStorageState {
  queue_items: RecursiveQueueItem[];
  lastUpdated: string;
}

const storage = createStorage<RecursiveQueueStorageState>(
  'recursive-queue-storage-key',
  {
    queue_items: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const recursiveQueueStorage = {
  ...storage,

  /**
   * 获取所有队列项
   */
  getAll: async (): Promise<RecursiveQueueItem[]> => {
    const state = await storage.get();
    return state.queue_items;
  },

  /**
   * 根据 ID 获取队列项
   */
  getById: async (id: string): Promise<RecursiveQueueItem | null> => {
    const state = await storage.get();
    return state.queue_items.find(item => item.id === id) || null;
  },

  /**
   * 获取下一个待处理项（BFS策略）
   */
  getNext: async (): Promise<RecursiveQueueItem | null> => {
    const state = await storage.get();
    const items = state.queue_items.filter(item => item.status === RecursiveQueueStatus.PENDING);

    if (items.length === 0) return null;

    // 广度优先：按深度排序，深度小的优先
    items.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      // 同一深度按创建时间排序
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return items[0];
  },

  /**
   * 入队
   */
  enqueue: async (item: RecursiveQueueItem): Promise<void> => {
    await storage.set(state => ({
      queue_items: [...state.queue_items, item],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 批量入队
   */
  enqueueBatch: async (items: RecursiveQueueItem[]): Promise<void> => {
    await storage.set(state => ({
      queue_items: [...state.queue_items, ...items],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新队列项
   */
  updateItem: async (id: string, updates: Partial<RecursiveQueueItem>): Promise<void> => {
    await storage.set(state => ({
      queue_items: state.queue_items.map(item =>
        item.id === id
          ? {
              ...item,
              ...updates,
              updated_at: new Date().toISOString(),
            }
          : item,
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 检查 URL 是否已存在
   */
  hasUrl: async (url: string): Promise<boolean> => {
    const state = await storage.get();
    return state.queue_items.some(item => item.url === url);
  },

  /**
   * 检查域名是否已存在
   */
  hasDomain: async (domain: string): Promise<boolean> => {
    const state = await storage.get();
    return state.queue_items.some(item => item.domain === domain);
  },

  /**
   * 批量检查 URL 是否存在，返回存在的 URL 集合
   */
  hasUrlBatch: async (urls: string[]): Promise<Set<string>> => {
    const state = await storage.get();
    const existing = new Set<string>();
    for (const url of urls) {
      if (state.queue_items.some(item => item.url === url)) {
        existing.add(url);
      }
    }
    return existing;
  },

  /**
   * 批量检查域名是否存在，返回存在的域名集合
   */
  hasDomainBatch: async (domains: string[]): Promise<Set<string>> => {
    const state = await storage.get();
    const existing = new Set<string>();
    for (const domain of domains) {
      if (state.queue_items.some(item => item.domain === domain)) {
        existing.add(domain);
      }
    }
    return existing;
  },

  /**
   * 获取指定深度的队列项
   */
  getByDepth: async (depth: number): Promise<RecursiveQueueItem[]> => {
    const state = await storage.get();
    return state.queue_items.filter(item => item.depth === depth);
  },

  /**
   * 获取指定状态的队列项
   */
  getByStatus: async (status: RecursiveQueueStatus): Promise<RecursiveQueueItem[]> => {
    const state = await storage.get();
    return state.queue_items.filter(item => item.status === status);
  },

  /**
   * 清空队列
   */
  clear: async (): Promise<void> => {
    await storage.set({
      queue_items: [],
      lastUpdated: new Date().toISOString(),
    });
  },

  /**
   * 删除队列项
   */
  deleteItem: async (id: string): Promise<void> => {
    await storage.set(state => ({
      queue_items: state.queue_items.filter(item => item.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 重置所有 IN_PROGRESS 状态为 PENDING（用于恢复）
   */
  resetInProgress: async (): Promise<void> => {
    await storage.set(state => ({
      queue_items: state.queue_items.map(item =>
        item.status === RecursiveQueueStatus.IN_PROGRESS
          ? {
              ...item,
              status: RecursiveQueueStatus.PENDING,
              updated_at: new Date().toISOString(),
            }
          : item,
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },
};
