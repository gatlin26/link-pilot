/**
 * Ahrefs 收集器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isAhrefsBacklinkChecker, getAhrefsTargetUrl, getAhrefsMode } from '../ahrefs-detector';
import { parseAhrefsApiResponse } from '../ahrefs-parser';
import { normalizeUrl, cleanText, extractDomain, isValidUrl } from '@root/packages/shared/lib/utils/dom-helpers';

describe('Ahrefs Detector', () => {
  beforeEach(() => {
    // 模拟 window.location
    delete (window as { location?: unknown }).location;
    window.location = {
      href: 'https://ahrefs.com/backlink-checker/?input=https%3A%2F%2Fahrefs.com%2F&mode=subdomains',
      hostname: 'ahrefs.com',
      search: '?input=https%3A%2F%2Fahrefs.com%2F&mode=subdomains',
    } as Location;
  });

  it('应该检测到 Ahrefs Backlink Checker 页面', () => {
    expect(isAhrefsBacklinkChecker()).toBe(true);
  });

  it('应该提取目标 URL', () => {
    const targetUrl = getAhrefsTargetUrl();
    expect(targetUrl).toBe('https://ahrefs.com/');
  });

  it('应该提取模式', () => {
    const mode = getAhrefsMode();
    expect(mode).toBe('subdomains');
  });

  it('应该在非 Ahrefs 页面返回 false', () => {
    window.location = {
      href: 'https://example.com',
      hostname: 'example.com',
      search: '',
    } as Location;

    expect(isAhrefsBacklinkChecker()).toBe(false);
  });
});

describe('DOM Helpers', () => {
  it('应该规范化 URL', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com:443/')).toBe('https://example.com');
    expect(normalizeUrl('http://example.com:80/')).toBe('http://example.com');
  });

  it('应该清理文本', () => {
    expect(cleanText('  hello   world  ')).toBe('hello world');
    expect(cleanText('hello\n\tworld')).toBe('hello world');
  });

  it('应该提取域名', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
    expect(extractDomain('http://example.com')).toBe('example.com');
  });

  it('应该验证 URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('Ahrefs Parser', () => {
  const mockApiResponse = {
    backlinks: [
      {
        url_from: 'https://example.com/page1',
        url_to: 'https://target.com',
        anchor: 'Example Link',
        title: 'Example Page',
        domain_rating: 75,
        url_rating: 60,
        ahrefs_rank: 1000,
      },
      {
        url_from: 'https://example.com/page2',
        url_to: 'https://target.com',
        anchor: 'Another Link',
        title: 'Another Page',
        domain_rating: 80,
      },
    ],
  };

  it('应该解析 API 响应', () => {
    const backlinks = parseAhrefsApiResponse(
      mockApiResponse,
      'https://target.com',
      'batch_123'
    );

    expect(backlinks).toHaveLength(2);
    expect(backlinks[0].referring_page_url).toBe('https://example.com/page1');
    expect(backlinks[0].anchor_text).toBe('Example Link');
    expect(backlinks[0].page_title).toBe('Example Page');
    expect(backlinks[0].raw_metrics.domain_rating).toBe(75);
  });

  it('应该处理空数据', () => {
    const backlinks = parseAhrefsApiResponse(
      { backlinks: [] },
      'https://target.com',
      'batch_123'
    );

    expect(backlinks).toHaveLength(0);
  });

  it('应该跳过无效的外链', () => {
    const invalidResponse = {
      backlinks: [
        {
          url_from: 'invalid-url',
          url_to: 'https://target.com',
        },
        {
          url_from: 'https://example.com/valid',
          url_to: 'https://target.com',
        },
      ],
    };

    const backlinks = parseAhrefsApiResponse(
      invalidResponse,
      'https://target.com',
      'batch_123'
    );

    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].referring_page_url).toBe('https://example.com/valid');
  });

  it('应该限制字段长度', () => {
    const longText = 'a'.repeat(1000);
    const response = {
      backlinks: [
        {
          url_from: 'https://example.com',
          url_to: 'https://target.com',
          anchor: longText,
          title: longText,
        },
      ],
    };

    const backlinks = parseAhrefsApiResponse(
      response,
      'https://target.com',
      'batch_123'
    );

    expect(backlinks[0].anchor_text.length).toBeLessThanOrEqual(500);
    expect(backlinks[0].page_title.length).toBeLessThanOrEqual(500);
    expect(backlinks[0].raw_snapshot.length).toBeLessThanOrEqual(5000);
  });
});
