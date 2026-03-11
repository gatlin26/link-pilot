/**
 * Ahrefs API 数据解析器
 */

import type { CollectedBacklink } from '@extension/shared/lib/types/models';
import { BacklinkStatus, SourcePlatform } from '@extension/shared/lib/types/enums';
import {
  normalizeUrl,
  cleanText,
  truncateString,
  extractDomain,
  isValidUrl,
} from '@extension/shared/lib/utils/dom-helpers';

/**
 * Ahrefs API 响应中的外链数据项
 */
interface AhrefsBacklinkItem {
  // 旧格式字段（下划线）
  url_to?: string;
  url_from?: string;
  anchor?: string;
  title?: string;
  domain_rating?: number;
  url_rating?: number;
  ahrefs_rank?: number;
  linked_domains?: number;
  external_links?: number;
  first_seen?: string;
  last_visited?: string;

  // 新格式字段（驼峰命名）
  urlTo?: string;
  urlFrom?: string;
  domainRating?: number;
  urlRating?: number;
  ahrefsRank?: number;
  linkedDomains?: number;
  externalLinks?: number;
  firstSeen?: string;
  lastVisited?: string;

  [key: string]: unknown;
}

/**
 * 解析 Ahrefs API 响应数据
 */
export function parseAhrefsApiResponse(
  responseData: unknown,
  targetUrl: string,
  batchId: string,
): CollectedBacklink[] {
  const results: CollectedBacklink[] = [];

  try {
    // 添加详细的数据结构日志
    console.log('[Ahrefs Parser] 开始解析响应数据');
    console.log('[Ahrefs Parser] 数据类型:', typeof responseData);
    console.log('[Ahrefs Parser] 是否为数组:', Array.isArray(responseData));

    // 检测是否是域统计 API 响应（不是外链列表）
    // 域统计响应格式: ["Ok",{data:{domainRating:...,backlinks:...,refdomains:...}}]
    if (Array.isArray(responseData) && responseData.length === 2) {
      const secondElement = responseData[1];
      if (secondElement && typeof secondElement === 'object' && !Array.isArray(secondElement)) {
        const innerData = secondElement as Record<string, unknown>;
        // 检查是否是域统计响应：data 包含 domainRating/backlinks/refdomains 且不是数组
        if (
          innerData.data &&
          typeof innerData.data === 'object' &&
          !Array.isArray(innerData.data)
        ) {
          const statsData = innerData.data as Record<string, unknown>;
          if (
            typeof statsData.domainRating === 'number' &&
            typeof statsData.backlinks === 'number' &&
            typeof statsData.refdomains === 'number' &&
            !Array.isArray(statsData.backlinks)
          ) {
            console.warn(
              '[Ahrefs Parser] 检测到域统计 API 响应，非外链列表，跳过解析',
            );
            console.warn(
              '[Ahrefs Parser] 域统计:',
              JSON.stringify(statsData).substring(0, 200),
            );
            return results;
          }
        }
      }
    }

    if (responseData && typeof responseData === 'object') {
      console.log('[Ahrefs Parser] 数据键:', Object.keys(responseData as Record<string, unknown>));
    }

    // 尝试多种可能的数据结构
    let backlinks: AhrefsBacklinkItem[] = [];

    if (Array.isArray(responseData)) {
      // 检查是否为 ["TopBacklinks", { backlinks: [...] }] 格式
      if (responseData.length === 2 && typeof responseData[1] === 'object' && responseData[1] !== null) {
        const secondElement = responseData[1] as Record<string, unknown>;
        if (Array.isArray(secondElement.backlinks)) {
          backlinks = secondElement.backlinks;
          console.log('[Ahrefs Parser] 使用格式: ["TopBacklinks", { backlinks: [...] }]');
        }
      } else {
        // 直接是数组
        backlinks = responseData;
        console.log('[Ahrefs Parser] 使用格式: 直接数组');
      }
    } else if (typeof responseData === 'object' && responseData !== null) {
      const data = responseData as Record<string, unknown>;

      // 尝试常见的数据路径
      if (Array.isArray(data.backlinks)) {
        backlinks = data.backlinks;
        console.log('[Ahrefs Parser] 使用格式: { backlinks: [...] }');
      } else if (Array.isArray(data.data)) {
        backlinks = data.data;
        console.log('[Ahrefs Parser] 使用格式: { data: [...] }');
      } else if (Array.isArray(data.results)) {
        backlinks = data.results;
        console.log('[Ahrefs Parser] 使用格式: { results: [...] }');
      } else if (Array.isArray(data.items)) {
        backlinks = data.items;
        console.log('[Ahrefs Parser] 使用格式: { items: [...] }');
      } else if (data.refpages && Array.isArray((data.refpages as Record<string, unknown>).backlinks)) {
        backlinks = ((data.refpages as Record<string, unknown>).backlinks) as AhrefsBacklinkItem[];
        console.log('[Ahrefs Parser] 使用格式: { refpages: { backlinks: [...] } }');
      }
    }

    if (backlinks.length === 0) {
      console.warn('[Ahrefs Parser] 未找到外链数据');
      console.warn('[Ahrefs Parser] 完整响应数据:', JSON.stringify(responseData).substring(0, 500));
      return results;
    }

    console.log(`[Ahrefs Parser] 找到 ${backlinks.length} 条原始外链数据`);

    // 打印第一条数据的结构用于调试
    if (backlinks.length > 0) {
      console.log('[Ahrefs Parser] 第一条数据示例:', JSON.stringify(backlinks[0]).substring(0, 300));
    }

    const now = new Date().toISOString();
    const targetDomain = extractDomain(targetUrl);

    // 解析每条外链数据
    for (const item of backlinks) {
      try {
        const backlink = parseBacklinkItem(item, targetUrl, targetDomain, batchId, now);
        if (backlink) {
          results.push(backlink);
        }
      } catch (error) {
        console.error('[Ahrefs Parser] 解析单条外链失败:', error, item);
        // 继续处理下一条，不中断整批
      }
    }

    console.log(`[Ahrefs Parser] 成功解析 ${results.length}/${backlinks.length} 条外链`);
  } catch (error) {
    console.error('[Ahrefs Parser] 解析 API 响应失败:', error);
  }

  return results;
}

/**
 * 解析单条外链数据
 */
function parseBacklinkItem(
  item: AhrefsBacklinkItem,
  targetUrl: string,
  targetDomain: string,
  batchId: string,
  timestamp: string,
): CollectedBacklink | null {
  // 防御性检查：确保 item 不为 null/undefined
  if (!item || typeof item !== 'object') {
    console.warn('[Ahrefs Parser] 无效的外链数据项:', item);
    return null;
  }

  // 提取必需字段（支持两种命名格式）
  const referringUrl = item.urlFrom || item.url_from ||
    (typeof item.referring_page_url === 'string' ? item.referring_page_url : '');
  const urlTo = item.urlTo || item.url_to || targetUrl;

  // 验证必需字段
  if (!referringUrl || !isValidUrl(referringUrl)) {
    console.warn('[Ahrefs Parser] 无效的引用 URL:', referringUrl, '原始数据:', item);
    return null;
  }

  // 规范化 URL
  const normalizedReferringUrl = normalizeUrl(referringUrl);
  const normalizedTargetUrl = normalizeUrl(urlTo);
  const referringDomain = extractDomain(normalizedReferringUrl);

  // 提取锚文本和标题
  const anchorText = cleanText(item.anchor || '');
  const pageTitle = cleanText(item.title || '');

  // 提取指标数据（支持两种命名格式）
  const rawMetrics: Record<string, unknown> = {
    domain_rating: item.domainRating || item.domain_rating,
    url_rating: item.urlRating || item.url_rating,
    ahrefs_rank: item.ahrefsRank || item.ahrefs_rank,
    linked_domains: item.linkedDomains || item.linked_domains,
    external_links: item.externalLinks || item.external_links,
    first_seen: item.firstSeen || item.first_seen,
    last_visited: item.lastVisited || item.last_visited,
  };

  // 移除 undefined 值
  Object.keys(rawMetrics).forEach(key => {
    if (rawMetrics[key] === undefined) {
      delete rawMetrics[key];
    }
  });

  // 生成原始快照（限制 5KB）
  const rawSnapshot = truncateString(JSON.stringify(item), 5000);

  // 生成唯一 ID
  const id = generateBacklinkId(normalizedReferringUrl, normalizedTargetUrl, batchId);

  const backlink: CollectedBacklink = {
    id,
    source_platform: SourcePlatform.AHREFS,
    collection_batch_id: batchId,
    collected_at: timestamp,
    target_domain: targetDomain,
    target_url: normalizedTargetUrl,
    referring_page_url: normalizedReferringUrl,
    referring_domain: referringDomain,
    anchor_text: truncateString(anchorText, 500),
    page_title: truncateString(pageTitle, 500),
    raw_metrics: rawMetrics,
    raw_snapshot: rawSnapshot,
    status: BacklinkStatus.COLLECTED,
    created_at: timestamp,
    updated_at: timestamp,
  };

  return backlink;
}

/**
 * 生成外链唯一 ID
 */
function generateBacklinkId(referringUrl: string, targetUrl: string, batchId: string): string {
  const hash = simpleHash(`${referringUrl}|${targetUrl}|${batchId}`);
  return `ahrefs_${hash}_${Date.now()}`;
}

/**
 * 简单哈希函数
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
