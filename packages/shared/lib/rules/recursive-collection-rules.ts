/**
 * 递归采集规则和配置
 */

import { DeduplicationStrategy, RecursiveStrategy, BusinessType } from '../types/enums.js';
import type { RecursiveCollectionConfig, SiteFilterRule } from '../types/models.js';

/**
 * 默认站点过滤规则
 */
export const DEFAULT_SITE_FILTERS: SiteFilterRule[] = [
  {
    id: 'ai-navigator-filter',
    name: 'AI 导航站点',
    business_types: [BusinessType.AI_TOOLS],
    domain_patterns: ['.*ai.*nav.*', '.*ai.*directory.*', '.*tool.*list.*', '.*ai.*hub.*'],
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
  {
    id: 'directory-filter',
    name: '通用目录站点',
    domain_patterns: ['.*directory.*', '.*listing.*', '.*catalog.*'],
    deduplication_level: 'domain',
    enabled: true,
  },
];

/**
 * 默认递归采集配置
 */
export const DEFAULT_RECURSIVE_CONFIG: RecursiveCollectionConfig = {
  max_depth: 3,
  max_links_per_url: 20,
  max_total_urls: 100,
  collection_interval_ms: 3000,
  max_retries: 3,
  deduplication: DeduplicationStrategy.HYBRID,
  site_filters: DEFAULT_SITE_FILTERS,
  auto_pause_on_limit: true,
};

/**
 * 预设配置
 */
export const RECURSIVE_CONFIG_PRESETS: Record<string, RecursiveCollectionConfig> = {
  quick: {
    ...DEFAULT_RECURSIVE_CONFIG,
    max_depth: 2,
    max_links_per_url: 10,
    max_total_urls: 50,
    collection_interval_ms: 2000,
  },
  standard: {
    ...DEFAULT_RECURSIVE_CONFIG,
    max_depth: 3,
    max_links_per_url: 20,
    max_total_urls: 100,
    collection_interval_ms: 3000,
  },
  deep: {
    ...DEFAULT_RECURSIVE_CONFIG,
    max_depth: 5,
    max_links_per_url: 30,
    max_total_urls: 300,
    collection_interval_ms: 4000,
  },
  conservative: {
    ...DEFAULT_RECURSIVE_CONFIG,
    max_depth: 2,
    max_links_per_url: 15,
    max_total_urls: 80,
    collection_interval_ms: 5000, // 更长的间隔，减少触发限制
  },
};

/**
 * 验证配置的有效性
 */
export function validateRecursiveConfig(config: Partial<RecursiveCollectionConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.max_depth !== undefined) {
    if (config.max_depth < 1 || config.max_depth > 10) {
      errors.push('最大深度必须在 1-10 之间');
    }
  }

  if (config.max_links_per_url !== undefined) {
    if (config.max_links_per_url < 1 || config.max_links_per_url > 100) {
      errors.push('每个 URL 的最大外链数必须在 1-100 之间');
    }
  }

  if (config.max_total_urls !== undefined) {
    if (config.max_total_urls < 1 || config.max_total_urls > 1000) {
      errors.push('总 URL 数量限制必须在 1-1000 之间');
    }
  }

  if (config.collection_interval_ms !== undefined) {
    if (config.collection_interval_ms < 1000 || config.collection_interval_ms > 60000) {
      errors.push('采集间隔必须在 1000-60000 毫秒之间');
    }
  }

  if (config.max_retries !== undefined) {
    if (config.max_retries < 0 || config.max_retries > 10) {
      errors.push('最大重试次数必须在 0-10 之间');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
