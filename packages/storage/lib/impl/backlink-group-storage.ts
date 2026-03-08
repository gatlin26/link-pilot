/**
 * 外链分组存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BacklinkGroup } from '@extension/shared';

export interface BacklinkGroupStorageState {
  groups: BacklinkGroup[];
  lastUpdated: string;
}

const storage = createStorage<BacklinkGroupStorageState>(
  'backlink-group-storage-key',
  {
    groups: [
      {
        id: 'default',
        name: '默认分组',
        backlink_count: 0,
        created_at: new Date().toISOString(),
      },
    ],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const backlinkGroupStorage = {
  ...storage,

  /**
   * 获取所有分组
   */
  getAll: async (): Promise<BacklinkGroup[]> => {
    const state = await storage.get();
    return state.groups;
  },

  /**
   * 根据 ID 获取分组
   */
  getById: async (id: string): Promise<BacklinkGroup | null> => {
    const state = await storage.get();
    return state.groups.find(g => g.id === id) || null;
  },

  /**
   * 添加分组
   */
  add: async (group: BacklinkGroup): Promise<void> => {
    await storage.set(state => ({
      groups: [...state.groups, group],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新分组
   */
  update: async (id: string, updates: Partial<BacklinkGroup>): Promise<void> => {
    await storage.set(state => ({
      groups: state.groups.map(g => (g.id === id ? { ...g, ...updates } : g)),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除分组
   */
  delete: async (id: string): Promise<void> => {
    await storage.set(state => ({
      groups: state.groups.filter(g => g.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },
};
