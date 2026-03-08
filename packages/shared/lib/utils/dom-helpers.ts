/**
 * DOM 辅助工具
 */

/**
 * 规范化 URL
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';

  try {
    const urlObj = new URL(url);
    // 移除尾部斜杠
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '');
    // 移除默认端口
    if ((urlObj.protocol === 'http:' && urlObj.port === '80') ||
        (urlObj.protocol === 'https:' && urlObj.port === '443')) {
      urlObj.port = '';
    }
    return urlObj.toString();
  } catch {
    return url.trim();
  }
}

/**
 * 清理文本
 */
export function cleanText(text: string): string {
  if (!text) return '';

  return text
    .replace(/\s+/g, ' ')  // 多个空白字符替换为单个空格
    .replace(/[\r\n\t]/g, ' ')  // 移除换行和制表符
    .trim();
}

/**
 * 限制字符串长度
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength);
}

/**
 * 从 URL 提取域名
 */
export function extractDomain(url: string): string {
  if (!url) return '';

  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // 尝试简单的正则提取
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
    return match ? match[1] : '';
  }
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全地解析 JSON
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}
