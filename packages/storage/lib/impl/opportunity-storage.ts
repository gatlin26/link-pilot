/**
 * 机会存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { Opportunity } from '@extension/shared';

export interface OpportunityStorageState {
  opportunities: Opportunity[];
  lastUpdated: string;
}

const storage = createStorage<OpportunityStorageState>(
  'opportunity-storage-key',
  {
    opportunities: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const opportunityStorage = {
  ...storage,

  /**
   * 获取所有机会
   */
  getAll: async (): Promise<Opportunity[]> => {
    const state = await storage.get();
    return state.opportunities;
  },

  /**
   * 根据 ID 获取机会
   */
  getById: async (id: string): Promise<Opportunity | null> => {
    const state = await storage.get();
    return state.opportunities.find(o => o.id === id) || null;
  },

  /**
   * 根据外链 ID 获取机会
   */
  getByBacklinkId: async (backlinkId: string): Promise<Opportunity | null> => {
    const state = await storage.get();
    return state.opportunities.find(o => o.collected_backlink_id === backlinkId) || null;
  },

  /**
   * 根据状态获取机会
   */
  getByStatus: async (status: string): Promise<Opportunity[]> => {
    const state = await storage.get();
    return state.opportunities.filter(o => o.status === status);
  },

  /**
   * 根据域名获取机会
   */
  getByDomain: async (domain: string): Promise<Opportunity[]> => {
    const state = await storage.get();
    return state.opportunities.filter(o => o.domain === domain);
  },

  /**
   * 添加机会
   */
  add: async (opportunity: Opportunity): Promise<void> => {
    await storage.set(state => ({
      opportunities: [...state.opportunities, opportunity],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 批量添加机会
   */
  addBatch: async (opportunities: Opportunity[]): Promise<void> => {
    await storage.set(state => ({
      opportunities: [...state.opportunities, ...opportunities],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新机会
   */
  update: async (id: string, updates: Partial<Opportunity>): Promise<void> => {
    await storage.set(state => ({
      opportunities: state.opportunities.map(o =>
        o.id === id ? { ...o, ...updates, updated_at: new Date().toISOString() } : o
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除机会
   */
  delete: async (id: string): Promise<void> => {
    await storage.set(state => ({
      opportunities: state.opportunities.filter(o => o.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 清空所有机会
   */
  clear: async (): Promise<void> => {
    await storage.set({
      opportunities: [],
      lastUpdated: new Date().toISOString(),
    });
  },

  /**
   * 获取排序后的机会
   */
  getSorted: async (
    sort: { field: keyof Opportunity; order: 'asc' | 'desc' },
    limit?: number,
  ): Promise<Opportunity[]> => {
    const state = await storage.get();
    let sorted = [...state.opportunities];

    sorted.sort((a, b) => {
      const aVal = a[sort.field];
      const bVal = b[sort.field];
      if (aVal === undefined || bVal === undefined) return 0;
      if (sort.order === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      }
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });

    if (limit) {
      sorted = sorted.slice(0, limit);
    }

    return sorted;
  },
};
