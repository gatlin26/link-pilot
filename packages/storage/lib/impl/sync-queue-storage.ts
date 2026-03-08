/**
 * 同步队列存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { SyncJob } from '@extension/shared';

export interface SyncQueueStorageState {
  jobs: SyncJob[];
  lastUpdated: string;
}

const storage = createStorage<SyncQueueStorageState>(
  'sync-queue-storage-key',
  {
    jobs: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const syncQueueStorage = {
  ...storage,

  /**
   * 获取所有同步任务
   */
  getAll: async (): Promise<SyncJob[]> => {
    const state = await storage.get();
    return state.jobs;
  },

  /**
   * 根据 ID 获取同步任务
   */
  getById: async (id: string): Promise<SyncJob | null> => {
    const state = await storage.get();
    return state.jobs.find(j => j.id === id) || null;
  },

  /**
   * 根据状态获取同步任务
   */
  getByStatus: async (status: string): Promise<SyncJob[]> => {
    const state = await storage.get();
    return state.jobs.filter(j => j.status === status);
  },

  /**
   * 根据实体类型和 ID 获取同步任务
   */
  getByEntity: async (entityType: string, entityId: string): Promise<SyncJob[]> => {
    const state = await storage.get();
    return state.jobs.filter(j => j.entity_type === entityType && j.entity_id === entityId);
  },

  /**
   * 获取待处理任务
   */
  getPending: async (limit?: number): Promise<SyncJob[]> => {
    const state = await storage.get();
    const pending = state.jobs
      .filter(j => j.status === 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return limit ? pending.slice(0, limit) : pending;
  },

  /**
   * 入队
   */
  enqueue: async (job: SyncJob): Promise<void> => {
    await storage.set(state => ({
      jobs: [...state.jobs, job],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 批量入队
   */
  enqueueBatch: async (jobs: SyncJob[]): Promise<void> => {
    await storage.set(state => ({
      jobs: [...state.jobs, ...jobs],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新任务
   */
  update: async (id: string, updates: Partial<SyncJob>): Promise<void> => {
    await storage.set(state => ({
      jobs: state.jobs.map(j =>
        j.id === id ? { ...j, ...updates, updated_at: new Date().toISOString() } : j
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 增加重试次数
   */
  incrementRetryCount: async (id: string): Promise<void> => {
    await storage.set(state => ({
      jobs: state.jobs.map(j =>
        j.id === id ? { ...j, retry_count: j.retry_count + 1, updated_at: new Date().toISOString() } : j
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除任务
   */
  delete: async (id: string): Promise<void> => {
    await storage.set(state => ({
      jobs: state.jobs.filter(j => j.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 清理已完成任务
   */
  cleanupCompleted: async (olderThan: Date): Promise<number> => {
    let deletedCount = 0;
    await storage.set(state => {
      const filtered = state.jobs.filter(j => {
        if (j.status === 'success' && new Date(j.updated_at) < olderThan) {
          deletedCount++;
          return false;
        }
        return true;
      });
      return {
        jobs: filtered,
        lastUpdated: new Date().toISOString(),
      };
    });
    return deletedCount;
  },

  /**
   * 清空所有任务
   */
  clear: async (): Promise<void> => {
    await storage.set({
      jobs: [],
      lastUpdated: new Date().toISOString(),
    });
  },
};
