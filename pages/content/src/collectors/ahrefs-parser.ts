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
    // 尝试多种可能的数据结构
    let backlinks: AhrefsBacklinkItem[] = [];

    if (Array.isArray(responseData)) {
      backlinks = responseData;
    } else if (typeof responseData === 'object' && responseData !== null) {
      const data = responseData as Record<string, unknown>;

      // 尝试常见的数据路径
      if (Array.isArray(data.backlinks)) {
        backlinks = data.backlinks;
      } else if (Array.isArray(data.data)) {
        backlinks = data.data;
      } else if (Array.isArray(data.results)) {
        backlinks = data.results;
      } else if (Array.isArray(data.items)) {
        backlinks = data.items;
      } else if (data.refpages && Array.isArray((data.refpages as Record<string, unknown>).backlinks)) {
        backlinks = ((data.refpages as Record<string, unknown>).backlinks) as AhrefsBacklinkItem[];
      }
    }

    if (backlinks.length === 0) {
      console.warn('[Ahrefs Parser] 未找到外链数据');
      return results;
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
  // 提取必需字段
  const referringUrl = typeof item.url_from === 'string'
    ? item.url_from
    : typeof item.referring_page_url === 'string'
      ? item.referring_page_url
      : '';
  const urlTo = typeof item.url_to === 'string' ? item.url_to : targetUrl;

  // 验证必需字段
  if (!referringUrl || !isValidUrl(referringUrl)) {
    console.warn('[Ahrefs Parser] 无效的引用 URL:', referringUrl);
    return null;
  }

  // 规范化 URL
  const normalizedReferringUrl = normalizeUrl(referringUrl);
  const normalizedTargetUrl = normalizeUrl(urlTo);
  const referringDomain = extractDomain(normalizedReferringUrl);

  // 提取锚文本和标题
  const anchorText = cleanText(item.anchor || '');
  const pageTitle = cleanText(item.title || '');

  // 提取指标数据
  const rawMetrics: Record<string, unknown> = {
    domain_rating: item.domain_rating,
    url_rating: item.url_rating,
    ahrefs_rank: item.ahrefs_rank,
    linked_domains: item.linked_domains,
    external_links: item.external_links,
    first_seen: item.first_seen,
    last_visited: item.last_visited,
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
