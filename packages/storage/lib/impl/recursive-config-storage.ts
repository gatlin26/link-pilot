/**
 * 递归配置存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { RecursiveCollectionConfig, RecursiveCollectionSession, SiteFilterRule } from '@extension/shared';
import { DeduplicationStrategy, RecursiveStrategy, RecursiveSessionStatus, BusinessType } from '@extension/shared';

export interface RecursiveConfigStorageState {
  default_config: RecursiveCollectionConfig;
  current_session: RecursiveCollectionSession | null;
  lastUpdated: string;
}

const DEFAULT_CONFIG: RecursiveCollectionConfig = {
  max_depth: 3,
  max_links_per_url: 20,
  max_total_urls: 100,
  collection_interval_ms: 3000,
  max_retries: 3,
  deduplication: DeduplicationStrategy.HYBRID,
  site_filters: [
    {
      id: 'ai-navigator-filter',
      name: 'AI 导航站点',
      business_types: [BusinessType.AI_TOOLS],
      domain_patterns: ['.*ai.*nav.*', '.*ai.*directory.*', '.*tool.*list.*'],
      deduplication_level: 'domain',
      enabled: true,
    },
    {
      id: 'ai-browser-filter',
      name: 'AI 浏览器站点',
      business_types: [BusinessType.AI_TOOLS],
      domain_patterns: ['.*ai.*browser.*', '.*ai.*search.*'],
      deduplication_level: 'domain',
      enabled: true,
    },
  ],
  auto_pause_on_limit: true,
};

const storage = createStorage<RecursiveConfigStorageState>(
  'recursive-config-storage-key',
  {
    default_config: DEFAULT_CONFIG,
    current_session: null,
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const recursiveConfigStorage = {
  ...storage,

  /**
   * 获取默认配置
   */
  getDefaultConfig: async (): Promise<RecursiveCollectionConfig> => {
    const state = await storage.get();
    return state.default_config;
  },

  /**
   * 更新默认配置
   */
  updateDefaultConfig: async (updates: Partial<RecursiveCollectionConfig>): Promise<void> => {
    await storage.set(state => ({
      ...state,
      default_config: {
        ...state.default_config,
        ...updates,
      },
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 获取当前会话
   */
  getCurrentSession: async (): Promise<RecursiveCollectionSession | null> => {
    const state = await storage.get();
    return state.current_session;
  },

  /**
   * 创建新会话
   */
  createSession: async (session: RecursiveCollectionSession): Promise<void> => {
    await storage.set(state => ({
      ...state,
      current_session: session,
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新当前会话
   */
  updateSession: async (updates: Partial<RecursiveCollectionSession>): Promise<void> => {
    await storage.set(state => {
      if (!state.current_session) {
        throw new Error('没有活动的会话');
      }
      return {
        ...state,
        current_session: {
          ...state.current_session,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        lastUpdated: new Date().toISOString(),
      };
    });
  },

  /**
   * 清除当前会话
   */
  clearSession: async (): Promise<void> => {
    await storage.set(state => ({
      ...state,
      current_session: null,
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 获取启用的站点过滤规则
   */
  getEnabledSiteFilters: async (): Promise<SiteFilterRule[]> => {
    const state = await storage.get();
    return state.default_config.site_filters.filter(filter => filter.enabled);
  },

  /**
   * 添加站点过滤规则
   */
  addSiteFilter: async (filter: SiteFilterRule): Promise<void> => {
    await storage.set(state => ({
      ...state,
      default_config: {
        ...state.default_config,
        site_filters: [...state.default_config.site_filters, filter],
      },
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新站点过滤规则
   */
  updateSiteFilter: async (id: string, updates: Partial<SiteFilterRule>): Promise<void> => {
    await storage.set(state => ({
      ...state,
      default_config: {
        ...state.default_config,
        site_filters: state.default_config.site_filters.map(filter =>
          filter.id === id ? { ...filter, ...updates } : filter,
        ),
      },
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除站点过滤规则
   */
  deleteSiteFilter: async (id: string): Promise<void> => {
    await storage.set(state => ({
      ...state,
      default_config: {
        ...state.default_config,
        site_filters: state.default_config.site_filters.filter(filter => filter.id !== id),
      },
      lastUpdated: new Date().toISOString(),
    }));
  },
};
