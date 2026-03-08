/**
 * 已收集外链存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { CollectedBacklink } from '@extension/shared';

export interface BacklinkStorageState {
  backlinks: CollectedBacklink[];
  lastUpdated: string;
}

const storage = createStorage<BacklinkStorageState>(
  'backlink-storage-key',
  {
    backlinks: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const backlinkStorage = {
  ...storage,

  /**
   * 获取所有外链
   */
  getAll: async (): Promise<CollectedBacklink[]> => {
    const state = await storage.get();
    return state.backlinks;
  },

  /**
   * 根据 ID 获取外链
   */
  getById: async (id: string): Promise<CollectedBacklink | null> => {
    const state = await storage.get();
    return state.backlinks.find(b => b.id === id) || null;
  },

  /**
   * 根据目标 URL 获取外链（去重）
   */
  getByTargetUrl: async (targetUrl: string): Promise<CollectedBacklink | null> => {
    const state = await storage.get();
    const normalizedUrl = targetUrl.toLowerCase().replace(/\/$/, '').replace(/#.*$/, '');
    return state.backlinks.find(b => {
      const normalized = b.target_url.toLowerCase().replace(/\/$/, '').replace(/#.*$/, '');
      return normalized === normalizedUrl;
    }) || null;
  },

  /**
   * 根据批次 ID 获取外链
   */
  getByBatchId: async (batchId: string): Promise<CollectedBacklink[]> => {
    const state = await storage.get();
    return state.backlinks.filter(b => b.collection_batch_id === batchId);
  },

  /**
   * 根据状态获取外链
   */
  getByStatus: async (status: string): Promise<CollectedBacklink[]> => {
    const state = await storage.get();
    return state.backlinks.filter(b => b.status === status);
  },

  /**
   * 添加外链
   */
  add: async (backlink: CollectedBacklink): Promise<void> => {
    await storage.set(state => ({
      backlinks: [...state.backlinks, backlink],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 批量添加外链
   */
  addBatch: async (backlinks: CollectedBacklink[]): Promise<void> => {
    await storage.set(state => ({
      backlinks: [...state.backlinks, ...backlinks],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新外链
   */
  update: async (id: string, updates: Partial<CollectedBacklink>): Promise<void> => {
    await storage.set(state => ({
      backlinks: state.backlinks.map(b =>
        b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除外链
   */
  delete: async (id: string): Promise<void> => {
    await storage.set(state => ({
      backlinks: state.backlinks.filter(b => b.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 清空所有外链
   */
  clear: async (): Promise<void> => {
    await storage.set({
      backlinks: [],
      lastUpdated: new Date().toISOString(),
    });
  },
};
