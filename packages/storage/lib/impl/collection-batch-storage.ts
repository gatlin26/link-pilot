/**
 * 收集批次存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { CollectionBatch } from '@extension/shared';

export interface CollectionBatchStorageState {
  batches: CollectionBatch[];
  lastUpdated: string;
}

const storage = createStorage<CollectionBatchStorageState>(
  'collection-batch-storage-key',
  {
    batches: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const collectionBatchStorage = {
  ...storage,

  /**
   * 获取所有批次
   */
  getAll: async (): Promise<CollectionBatch[]> => {
    const state = await storage.get();
    return state.batches;
  },

  /**
   * 根据 ID 获取批次
   */
  getById: async (id: string): Promise<CollectionBatch | null> => {
    const state = await storage.get();
    return state.batches.find(b => b.id === id) || null;
  },

  /**
   * 获取最近的批次
   */
  getRecent: async (limit: number = 10): Promise<CollectionBatch[]> => {
    const state = await storage.get();
    return state.batches
      .sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())
      .slice(0, limit);
  },

  /**
   * 添加批次
   */
  add: async (batch: CollectionBatch): Promise<void> => {
    await storage.set(state => ({
      batches: [...state.batches, batch],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新批次
   */
  update: async (id: string, updates: Partial<CollectionBatch>): Promise<void> => {
    await storage.set(state => ({
      batches: state.batches.map(b =>
        b.id === id ? { ...b, ...updates } : b
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新同步状态
   */
  updateSyncStatus: async (id: string, syncStatus: string, syncedCount: number): Promise<void> => {
    await storage.set(state => ({
      batches: state.batches.map(b =>
        b.id === id ? { ...b, sync_status: syncStatus as any, synced_count: syncedCount } : b
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除批次
   */
  delete: async (id: string): Promise<void> => {
    await storage.set(state => ({
      batches: state.batches.filter(b => b.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 清空所有批次
   */
  clear: async (): Promise<void> => {
    await storage.set({
      batches: [],
      lastUpdated: new Date().toISOString(),
    });
  },
};
