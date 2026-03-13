/**
 * URL 处理工具函数
 * 提供 URL 规范化、域名提取等功能
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * URL 规范化选项
 */
export interface NormalizeUrlOptions {
  /** 是否移除查询参数 */
  removeQuery?: boolean;
  /** 是否移除 hash */
  removeHash?: boolean;
  /** 是否移除尾部斜杠 */
  removeTrailingSlash?: boolean;
  /** 是否转换为小写 */
  lowercase?: boolean;
}

/**
 * 规范化 URL
 * 统一 URL 格式，便于比较和缓存
 *
 * @param url - 原始 URL
 * @param options - 规范化选项
 * @returns 规范化后的 URL
 *
 * @example
 * ```typescript
 * normalizeUrl('https://example.com/path/?foo=bar#hash')
 * // => 'https://example.com/path'
 *
 * normalizeUrl('https://example.com/path/', { removeTrailingSlash: false })
 * // => 'https://example.com/path/'
 * ```
 */
export function normalizeUrl(
  url: string,
  options: NormalizeUrlOptions = {},
): string {
  const {
    removeQuery = false,
    removeHash = true,
    removeTrailingSlash = true,
    lowercase = false,
  } = options;

  try {
    const urlObj = new URL(url);

    // 移除 hash
    if (removeHash) {
      urlObj.hash = '';
    }

    // 移除查询参数
    if (removeQuery) {
      urlObj.search = '';
    }

    let normalized = urlObj.toString();

    // 移除尾部斜杠（但保留根路径的斜杠）
    if (removeTrailingSlash && normalized.endsWith('/') && urlObj.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }

    // 转换为小写
    if (lowercase) {
      normalized = normalized.toLowerCase();
    }

    return normalized;
  } catch (error) {
    // 如果不是有效的 URL，返回原始字符串
    return url;
  }
}

/**
 * 提取域名
 * @param url - URL 字符串
 * @returns 域名，失败返回空字符串
 *
 * @example
 * ```typescript
 * extractDomain('https://www.example.com/path')
 * // => 'www.example.com'
 * ```
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return '';
  }
}

/**
 * 提取根域名（去除子域名）
 * @param url - URL 字符串
 * @returns 根域名，失败返回空字符串
 *
 * @example
 * ```typescript
 * extractRootDomain('https://www.example.com/path')
 * // => 'example.com'
 *
 * extractRootDomain('https://blog.example.co.uk/path')
 * // => 'example.co.uk'
 * ```
 */
export function extractRootDomain(url: string): string {
  const domain = extractDomain(url);
  if (!domain) {
    return '';
  }

  // 简单的根域名提取（不处理复杂的公共后缀列表）
  const parts = domain.split('.');
  if (parts.length <= 2) {
    return domain;
  }

  // 处理常见的二级域名后缀（如 .co.uk, .com.cn）
  const secondLevelTlds = new Set([
    'co.uk',
    'com.au',
    'com.cn',
    'co.jp',
    'co.kr',
    'com.br',
    'com.mx',
  ]);

  const lastTwo = parts.slice(-2).join('.');
  if (secondLevelTlds.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

/**
 * 检查两个 URL 是否指向同一个页面
 * @param url1 - URL 1
 * @param url2 - URL 2
 * @param ignoreQuery - 是否忽略查询参数
 * @returns 是否相同
 *
 * @example
 * ```typescript
 * isSameUrl(
 *   'https://example.com/path#hash1',
 *   'https://example.com/path#hash2'
 * )
 * // => true
 * ```
 */
export function isSameUrl(
  url1: string,
  url2: string,
  ignoreQuery: boolean = false,
): boolean {
  const normalized1 = normalizeUrl(url1, {
    removeHash: true,
    removeQuery: ignoreQuery,
    removeTrailingSlash: true,
  });

  const normalized2 = normalizeUrl(url2, {
    removeHash: true,
    removeQuery: ignoreQuery,
    removeTrailingSlash: true,
  });

  return normalized1 === normalized2;
}

/**
 * 检查 URL 是否有效
 * @param url - URL 字符串
 * @returns 是否有效
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 将相对 URL 转换为绝对 URL
 * @param relativeUrl - 相对 URL
 * @param baseUrl - 基础 URL
 * @returns 绝对 URL
 *
 * @example
 * ```typescript
 * toAbsoluteUrl('/path', 'https://example.com')
 * // => 'https://example.com/path'
 * ```
 */
export function toAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch (error) {
    return relativeUrl;
  }
}

/**
 * 从 URL 中提取查询参数
 * @param url - URL 字符串
 * @returns 查询参数对象
 *
 * @example
 * ```typescript
 * getQueryParams('https://example.com?foo=bar&baz=qux')
 * // => { foo: 'bar', baz: 'qux' }
 * ```
 */
export function getQueryParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};

    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return params;
  } catch (error) {
    return {};
  }
}
