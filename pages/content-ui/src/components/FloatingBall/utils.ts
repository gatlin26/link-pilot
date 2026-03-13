/**
 * 页面信息提取工具
 */

/**
 * 提取的页面信息
 */
export interface ExtractedPageInfo {
  /** 页面 URL */
  url: string;
  /** 域名 */
  domain: string;
  /** 页面标题 */
  title: string;
  /** 页面描述 */
  description?: string;
}

/**
 * 从当前页面提取信息
 */
export function extractPageInfo(): ExtractedPageInfo {
  const url = window.location.href;
  const title = document.title || '';

  // 尝试从 meta 标签获取描述
  const descriptionMeta = document.querySelector('meta[name="description"]');
  const description = descriptionMeta?.getAttribute('content') || undefined;

  return {
    url,
    domain: extractDomain(url),
    title,
    description,
  };
}

/**
 * 从 URL 提取域名
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // 如果 URL 无效，尝试简单提取
    const match = url.match(/^https?:\/\/([^\/]+)/i);
    return match ? match[1].replace(/^www\./, '') : url;
  }
}

/**
 * 规范化 URL（用于比较）
 */
export function normalizeUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '') // 移除末尾斜杠
    .replace(/^https:\/\//i, 'http://') // 统一为 http
    .toLowerCase();
}

/**
 * 验证 URL 是否有效
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim().length === 0) {
    return false;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 解析关键词字符串为数组
 */
export function parseKeywords(keywordsString: string): string[] {
  if (!keywordsString.trim()) return [];

  return keywordsString
    .split(/[,，]/) // 支持中英文逗号
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

/**
 * 格式化关键词数组为字符串
 */
export function formatKeywords(keywords: string[]): string {
  return keywords.join(', ');
}
