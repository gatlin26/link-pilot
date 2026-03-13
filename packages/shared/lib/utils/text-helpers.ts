/**
 * 文本处理辅助工具
 * 提供关键词匹配、文本规范化等功能
 *
 * @author Link Pilot Team
 * @date 2026-03-13
 */

/**
 * 检查文本是否包含任意关键词
 *
 * @param text - 待检查的文本
 * @param keywords - 关键词列表
 * @returns 是否匹配任意关键词
 */
export function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  if (!text || !keywords || keywords.length === 0) {
    return false;
  }

  const normalized = text.toLowerCase().trim();
  return keywords.some(keyword => normalized.includes(keyword.toLowerCase()));
}

/**
 * 检查文本是否匹配任意正则表达式
 *
 * @param text - 待检查的文本
 * @param patterns - 正则表达式列表
 * @returns 是否匹配任意正则
 */
export function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  if (!text || !patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some(pattern => pattern.test(text));
}
