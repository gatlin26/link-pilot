/**
 * 站点模板存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { SiteTemplate } from '@extension/shared';

export interface TemplateStorageState {
  templates: SiteTemplate[];
  lastUpdated: string;
}

const storage = createStorage<TemplateStorageState>(
  'template-storage-key',
  {
    templates: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const templateStorage = {
  ...storage,

  /**
   * 获取所有模板
   */
  getAll: async (): Promise<SiteTemplate[]> => {
    const state = await storage.get();
    return state.templates;
  },

  /**
   * 根据 ID 获取模板
   */
  getById: async (id: string): Promise<SiteTemplate | null> => {
    const state = await storage.get();
    return state.templates.find(t => t.id === id) || null;
  },

  /**
   * 根据域名和页面类型获取模板
   */
  getByDomainAndPageType: async (domain: string, pageType: string): Promise<SiteTemplate[]> => {
    const state = await storage.get();
    return state.templates.filter(t => t.domain === domain && t.page_type === pageType);
  },

  /**
   * 获取最新版本模板
   */
  getLatestVersion: async (domain: string, pageType: string, pathPattern: string): Promise<SiteTemplate | null> => {
    const state = await storage.get();
    const templates = state.templates
      .filter(t => t.domain === domain && t.page_type === pageType && t.path_pattern === pathPattern)
      .sort((a, b) => b.version - a.version);
    return templates[0] || null;
  },

  /**
   * 添加模板
   */
  add: async (template: SiteTemplate): Promise<void> => {
    await storage.set(state => ({
      templates: [...state.templates, template],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新模板
   */
  update: async (id: string, updates: Partial<SiteTemplate>): Promise<void> => {
    await storage.set(state => ({
      templates: state.templates.map(t =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除模板
   */
  delete: async (id: string): Promise<void> => {
    await storage.set(state => ({
      templates: state.templates.filter(t => t.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 清空所有模板
   */
  clear: async (): Promise<void> => {
    await storage.set({
      templates: [],
      lastUpdated: new Date().toISOString(),
    });
  },
};
