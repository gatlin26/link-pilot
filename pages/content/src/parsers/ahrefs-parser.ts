/**
 * Ahrefs 页面解析器
 */

import type { CollectedBacklink } from '@extension/shared/lib/types/models';
import { SourcePlatform, BacklinkStatus } from '@extension/shared/lib/types/enums';
import {
  cleanText,
  extractDomain,
  isValidUrl,
  normalizeUrl,
  truncateString,
} from '@extension/shared/lib/utils/dom-helpers';
import { getAhrefsTargetUrl } from '../collectors/ahrefs-detector';

const ROW_SELECTORS = [
  'table tbody tr',
  'table tr',
  '[role="row"]',
  '.rt-tr-group',
  '.rt-tr',
  '[data-rowindex]',
].join(', ');

/**
 * 检查是否为 Ahrefs 页面
 */
export function isAhrefsPage(): boolean {
  return window.location.hostname.includes('ahrefs.com') && window.location.href.includes('/backlink-checker');
}

/**
 * 获取可收集的外链数量
 */
export function getAvailableCount(): number {
  if (!isAhrefsPage()) {
    return 0;
  }

  const rows = findLikelyBacklinkRows();
  return rows.length > 0 ? rows.length : 20;
}

/**
 * 解析 Ahrefs 页面中的外链数据
 */
export function parseBacklinks(count: 10 | 20): CollectedBacklink[] {
  const targetUrl = getCollectionTargetUrl();
  if (!targetUrl) {
    return [];
  }

  const batchId = crypto.randomUUID();
  const collectedAt = new Date().toISOString();
  const targetDomain = extractDomain(targetUrl);
  const backlinks: CollectedBacklink[] = [];

  const rows = findLikelyBacklinkRows().slice(0, count);

  rows.forEach((row, index) => {
    try {
      const referringPageUrl = extractReferringUrl(row, targetUrl, targetDomain);
      if (!referringPageUrl) {
        return;
      }

      const normalizedReferringUrl = normalizeUrl(referringPageUrl);
      const normalizedTargetUrl = normalizeUrl(targetUrl);
      const rowText = cleanText(row.textContent || '');
      const cellTexts = getCandidateTexts(row);

      const backlink: CollectedBacklink = {
        id: generateBacklinkId(normalizedReferringUrl, normalizedTargetUrl, index),
        source_platform: SourcePlatform.AHREFS,
        collection_batch_id: batchId,
        collected_at: collectedAt,
        target_domain: targetDomain,
        target_url: normalizedTargetUrl,
        referring_page_url: normalizedReferringUrl,
        referring_domain: extractDomain(normalizedReferringUrl),
        anchor_text: truncateString(extractAnchorText(cellTexts, rowText, normalizedReferringUrl, normalizedTargetUrl), 500),
        page_title: truncateString(extractPageTitle(cellTexts, rowText, normalizedReferringUrl), 500),
        raw_metrics: extractMetrics(rowText),
        raw_snapshot: truncateString(row.outerHTML, 5000),
        status: BacklinkStatus.COLLECTED,
        created_at: collectedAt,
        updated_at: collectedAt,
      };

      backlinks.push(backlink);
    } catch (error) {
      console.error('解析外链数据失败:', error);
    }
  });

  return backlinks;
}

function getCollectionTargetUrl(): string | null {
  const fromQuery = getAhrefsTargetUrl();
  if (fromQuery && isValidUrl(fromQuery)) {
    return fromQuery;
  }

  const candidates = [
    'input[name="input"]',
    'input[type="url"]',
    'input[placeholder*="http"]',
    'textarea',
  ];

  for (const selector of candidates) {
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    const value = input?.value?.trim();
    if (value && isValidUrl(value)) {
      return value;
    }
  }

  return null;
}

function findLikelyBacklinkRows(): HTMLElement[] {
  const targetUrl = getCollectionTargetUrl();
  const targetDomain = targetUrl ? extractDomain(targetUrl) : '';
  const rowElements = Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTORS));

  const likelyRows = rowElements.filter(row => {
    const rowText = cleanText(row.textContent || '');
    if (rowText.length < 20) {
      return false;
    }

    const referringUrl = extractReferringUrl(row, targetUrl || '', targetDomain);
    return Boolean(referringUrl);
  });

  const deduped = new Map<string, HTMLElement>();
  for (const row of likelyRows) {
    const signature = cleanText(row.textContent || '').slice(0, 200);
    if (!deduped.has(signature)) {
      deduped.set(signature, row);
    }
  }

  return Array.from(deduped.values());
}

function extractReferringUrl(row: HTMLElement, targetUrl: string, targetDomain: string): string | null {
  const normalizedTarget = normalizeUrl(targetUrl);
  const anchors = Array.from(row.querySelectorAll<HTMLAnchorElement>('a[href]'));

  for (const anchor of anchors) {
    const href = anchor.href?.trim();
    if (!href || !isValidUrl(href)) {
      continue;
    }

    const normalized = normalizeUrl(href);
    const domain = extractDomain(normalized);
    if (!domain || domain.includes('ahrefs.com')) {
      continue;
    }

    if (normalized === normalizedTarget) {
      continue;
    }

    if (targetDomain && domain === targetDomain && normalized.startsWith(normalizedTarget)) {
      continue;
    }

    return normalized;
  }

  return null;
}

function getCandidateTexts(row: HTMLElement): string[] {
  const cellSelectors = ['td', '[role="cell"]', '.cell', '.truncate', '.css-1dbjc4n'];
  const texts: string[] = [];

  for (const selector of cellSelectors) {
    const elements = Array.from(row.querySelectorAll<HTMLElement>(selector));
    for (const element of elements) {
      const text = cleanText(element.textContent || '');
      if (text && text.length > 1) {
        texts.push(text);
      }
    }
    if (texts.length > 0) {
      break;
    }
  }

  if (texts.length === 0) {
    const fallback = cleanText(row.textContent || '');
    if (fallback) {
      texts.push(fallback);
    }
  }

  return texts;
}

function extractPageTitle(cellTexts: string[], rowText: string, referringUrl: string): string {
  const referringDomain = extractDomain(referringUrl);
  const candidates = cellTexts.filter(text => {
    if (text === referringUrl || text.includes(referringDomain)) {
      return false;
    }
    if (isValidUrl(text)) {
      return false;
    }
    return /[a-zA-Z\u4e00-\u9fa5]/.test(text);
  });

  return candidates.find(text => text.length >= 8) || rowText.replace(referringUrl, '').slice(0, 120) || referringDomain;
}

function extractAnchorText(cellTexts: string[], rowText: string, referringUrl: string, targetUrl: string): string {
  const excluded = new Set([referringUrl, targetUrl, normalizeUrl(referringUrl), normalizeUrl(targetUrl)]);
  const candidate = cellTexts.find(text => {
    if (excluded.has(text) || isValidUrl(text)) {
      return false;
    }
    return text.length >= 2 && text.length <= 200;
  });

  return candidate || rowText.slice(0, 120);
}

function extractMetrics(rowText: string): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};
  const normalized = rowText.replace(/,/g, '');

  const dr = normalized.match(/\bDR\s*(\d{1,3})\b/i);
  if (dr) {
    metrics.domain_rating = Number(dr[1]);
  }

  const ur = normalized.match(/\bUR\s*(\d{1,3})\b/i);
  if (ur) {
    metrics.url_rating = Number(ur[1]);
  }

  const traffic = normalized.match(/\btraffic\s*(\d+)\b/i);
  if (traffic) {
    metrics.traffic = Number(traffic[1]);
  }

  return metrics;
}

function generateBacklinkId(referringUrl: string, targetUrl: string, index: number): string {
  const raw = `${referringUrl}|${targetUrl}|${index}`;
  let hash = 0;

  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }

  return `ahrefs_${Math.abs(hash).toString(36)}`;
}
