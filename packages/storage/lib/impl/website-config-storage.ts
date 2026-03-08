/**
 * 网站配置存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { WebsiteConfig, WebsiteGroup } from '@extension/shared';

export interface WebsiteConfigStorageState {
  configs: WebsiteConfig[];
  groups: WebsiteGroup[];
  lastUpdated: string;
}

const storage = createStorage<WebsiteConfigStorageState>(
  'website-config-storage-key',
  {
    configs: [],
    groups: [
      {
        id: 'default',
        name: '默认分组',
        website_count: 0,
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

export const websiteConfigStorage = {
  ...storage,

  /**
   * 获取所有网站配置
   */
  getAllConfigs: async (): Promise<WebsiteConfig[]> => {
    const state = await storage.get();
    return state.configs;
  },

  /**
   * 根据 ID 获取网站配置
   */
  getConfigById: async (id: string): Promise<WebsiteConfig | null> => {
    const state = await storage.get();
    return state.configs.find(c => c.id === id) || null;
  },

  /**
   * 根据分组获取网站配置
   */
  getConfigsByGroup: async (groupId: string): Promise<WebsiteConfig[]> => {
    const state = await storage.get();
    return state.configs.filter(c => c.group_id === groupId);
  },

  /**
   * 添加网站配置
   */
  addConfig: async (config: WebsiteConfig): Promise<void> => {
    await storage.set(state => ({
      ...state,
      configs: [...state.configs, config],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新网站配置
   */
  updateConfig: async (id: string, updates: Partial<WebsiteConfig>): Promise<void> => {
    await storage.set(state => ({
      ...state,
      configs: state.configs.map(c =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除网站配置
   */
  deleteConfig: async (id: string): Promise<void> => {
    await storage.set(state => ({
      ...state,
      configs: state.configs.filter(c => c.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 获取所有分组
   */
  getAllGroups: async (): Promise<WebsiteGroup[]> => {
    const state = await storage.get();
    return state.groups;
  },

  /**
   * 添加分组
   */
  addGroup: async (group: WebsiteGroup): Promise<void> => {
    await storage.set(state => ({
      ...state,
      groups: [...state.groups, group],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新分组
   */
  updateGroup: async (id: string, updates: Partial<WebsiteGroup>): Promise<void> => {
    await storage.set(state => ({
      ...state,
      groups: state.groups.map(g => (g.id === id ? { ...g, ...updates } : g)),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除分组
   */
  deleteGroup: async (id: string): Promise<void> => {
    await storage.set(state => ({
      ...state,
      groups: state.groups.filter(g => g.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },
};
