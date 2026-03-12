/**
 * 机会存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import { OpportunityStatus } from '@extension/shared';
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
   * 获取排序后的机会列表
   */
  getSorted: async (
    sort: { field: 'created_at' | 'updated_at' | 'domain'; order: 'asc' | 'desc' },
    limit?: number,
  ): Promise<Opportunity[]> => {
    const state = await storage.get();
    const opportunities = [...state.opportunities];

    // 使用时间戳索引排序
    opportunities.sort((a, b) => {
      let comparison = 0;
      if (sort.field === 'created_at' || sort.field === 'updated_at') {
        const timeA = new Date(a[sort.field]).getTime();
        const timeB = new Date(b[sort.field]).getTime();
        comparison = timeA - timeB;
      } else if (sort.field === 'domain') {
        comparison = a.domain.localeCompare(b.domain);
      }
      return sort.order === 'desc' ? -comparison : comparison;
    });

    // 限制结果数量
    if (limit && limit > 0) {
      return opportunities.slice(0, limit);
    }

    return opportunities;
  },

  /**
   * 批量检查 URL 是否存在
   */
  existsBatch: async (urls: string[]): Promise<Set<string>> => {
    const state = await storage.get();
    const normalizedUrls = urls.map(url => url.trim().replace(/\/+$/, '').toLowerCase());
    const existingSet = new Set(state.opportunities.map(opp => opp.url.trim().replace(/\/+$/, '').toLowerCase()));

    const foundUrls = new Set<string>();
    for (const url of normalizedUrls) {
      if (existingSet.has(url)) {
        foundUrls.add(url);
      }
    }
    return foundUrls;
  },

  /**
   * 获取所有域名列表（去重）
   */
  getDomains: async (): Promise<string[]> => {
    const state = await storage.get();
    const domains = new Set(state.opportunities.map(opp => opp.domain.toLowerCase()));
    return Array.from(domains).sort();
  },

  /**
   * 根据域名获取URL列表
   */
  getUrlsByDomain: async (domain: string): Promise<string[]> => {
    const state = await storage.get();
    return state.opportunities
      .filter(o => o.domain.toLowerCase() === domain.toLowerCase())
      .map(o => o.url);
  },

  /**
   * 根据域名分组获取机会
   */
  getGroupedByDomain: async (): Promise<Record<string, { urls: string[]; count: number; statuses: Record<string, number> }>> => {
    const state = await storage.get();
    const grouped: Record<string, { urls: string[]; count: number; statuses: Record<string, number> }> = {};

    for (const opp of state.opportunities) {
      const domain = opp.domain.toLowerCase();
      if (!grouped[domain]) {
        grouped[domain] = { urls: [], count: 0, statuses: {} };
      }
      grouped[domain].urls.push(opp.url);
      grouped[domain].count++;
      grouped[domain].statuses[opp.status] = (grouped[domain].statuses[opp.status] || 0) + 1;
    }

    return grouped;
  },

  /**
   * 获取待审核的机会（status: new）
   */
  getPendingReview: async (): Promise<Opportunity[]> => {
    const state = await storage.get();
    return state.opportunities.filter(o => o.status === OpportunityStatus.NEW);
  },

  /**
   * 标记为已转化
   */
  markAsConverted: async (id: string, backlinkId: string): Promise<void> => {
    await storage.set(state => ({
      opportunities: state.opportunities.map(o =>
        o.id === id ? { ...o, status: OpportunityStatus.CONVERTED, converted_backlink_id: backlinkId, updated_at: new Date().toISOString() } : o
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 标记为已丢弃
   */
  markAsDiscarded: async (id: string, reason?: string): Promise<void> => {
    await storage.set(state => ({
      opportunities: state.opportunities.map(o =>
        o.id === id ? { ...o, status: OpportunityStatus.DISCARDED, discard_reason: reason, updated_at: new Date().toISOString() } : o
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },
};
