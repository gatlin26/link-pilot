/**
 * 评分规则
 */

import { LinkType, BusinessType } from '../types/enums.js';

/**
 * Link Type 权重（满分 30 分）
 */
export const LINK_TYPE_WEIGHTS: Record<LinkType, number> = {
  [LinkType.BLOG_COMMENT]: 30, // V1 重点支持
  [LinkType.GUEST_POST]: 25,
  [LinkType.RESOURCE_PAGE]: 20,
  [LinkType.FORUM]: 15,
  [LinkType.DIRECTORY]: 10,
  [LinkType.UNKNOWN]: 0,
};

/**
 * Business Type 权重（满分 40 分）
 */
export const BUSINESS_TYPE_WEIGHTS: Record<BusinessType, number> = {
  [BusinessType.AI_TOOLS]: 40, // 假设我们的产品是 AI 工具
  [BusinessType.SEO]: 35,
  [BusinessType.SAAS]: 30,
  [BusinessType.MARKETING]: 25,
  [BusinessType.PRODUCTIVITY]: 20,
  [BusinessType.DEVELOPMENT]: 15,
  [BusinessType.DESIGN]: 15,
  [BusinessType.CONTENT]: 10,
  [BusinessType.ANALYTICS]: 10,
  [BusinessType.ECOMMERCE]: 5,
  [BusinessType.OTHER]: 0,
};

/**
 * 域名权重等级（满分 20 分）
 */
export const DOMAIN_RATING_WEIGHTS = {
  HIGH: 20,    // DR >= 70
  MEDIUM: 15,  // DR >= 40
  LOW: 10,     // DR >= 20
  VERY_LOW: 5, // DR < 20
};

/**
 * 内容相关性权重（满分 10 分）
 */
export const CONTENT_RELEVANCE_WEIGHTS = {
  HIGH: 10,    // 锚文本和标题都相关
  MEDIUM: 7,   // 锚文本或标题相关
  LOW: 3,      // 仅有轻微相关
  NONE: 0,     // 不相关
};

/**
 * 计算 Link Type 分数
 */
export function calculateLinkTypeScore(linkType: LinkType): number {
  return LINK_TYPE_WEIGHTS[linkType] || 0;
}

/**
 * 计算 Business Type 分数
 */
export function calculateBusinessTypeScore(businessTypes: BusinessType[]): number {
  if (businessTypes.length === 0) {
    return 0;
  }

  // 取最高分
  const maxScore = Math.max(...businessTypes.map(type => BUSINESS_TYPE_WEIGHTS[type] || 0));

  // 如果有多个业务类型，给予额外加分（最多 5 分）
  const bonusScore = Math.min((businessTypes.length - 1) * 2, 5);

  return Math.min(maxScore + bonusScore, 40);
}

/**
 * 计算域名权重分数
 */
export function calculateDomainRatingScore(domainRating?: number): number {
  if (!domainRating) {
    return DOMAIN_RATING_WEIGHTS.VERY_LOW;
  }

  if (domainRating >= 70) {
    return DOMAIN_RATING_WEIGHTS.HIGH;
  } else if (domainRating >= 40) {
    return DOMAIN_RATING_WEIGHTS.MEDIUM;
  } else if (domainRating >= 20) {
    return DOMAIN_RATING_WEIGHTS.LOW;
  } else {
    return DOMAIN_RATING_WEIGHTS.VERY_LOW;
  }
}

/**
 * 计算内容相关性分数
 */
export function calculateContentRelevanceScore(anchor: string, title: string): number {
  const anchorLower = anchor.toLowerCase();
  const titleLower = title.toLowerCase();

  // 相关关键词列表（根据实际产品调整）
  const relevantKeywords = [
    'link',
    'seo',
    'tool',
    'software',
    'platform',
    'service',
    'solution',
  ];

  const anchorRelevant = relevantKeywords.some(keyword => anchorLower.includes(keyword));
  const titleRelevant = relevantKeywords.some(keyword => titleLower.includes(keyword));

  if (anchorRelevant && titleRelevant) {
    return CONTENT_RELEVANCE_WEIGHTS.HIGH;
  } else if (anchorRelevant || titleRelevant) {
    return CONTENT_RELEVANCE_WEIGHTS.MEDIUM;
  } else if (anchorLower.length > 0 && titleLower.length > 0) {
    return CONTENT_RELEVANCE_WEIGHTS.LOW;
  } else {
    return CONTENT_RELEVANCE_WEIGHTS.NONE;
  }
}

/**
 * 计算总分（满分 100 分）
 */
export function calculateTotalScore(
  linkType: LinkType,
  businessTypes: BusinessType[],
  domainRating?: number,
  anchor?: string,
  title?: string,
): number {
  const linkTypeScore = calculateLinkTypeScore(linkType);
  const businessTypeScore = calculateBusinessTypeScore(businessTypes);
  const domainRatingScore = calculateDomainRatingScore(domainRating);
  const contentRelevanceScore = calculateContentRelevanceScore(anchor || '', title || '');

  return linkTypeScore + businessTypeScore + domainRatingScore + contentRelevanceScore;
}

/**
 * 生成评分说明
 */
export function generateScoreNote(
  linkType: LinkType,
  businessTypes: BusinessType[],
  score: number,
): string {
  const parts: string[] = [];

  // Link Type 说明
  if (linkType === LinkType.BLOG_COMMENT) {
    parts.push('博客评论类型（V1 重点支持）');
  } else if (linkType !== LinkType.UNKNOWN) {
    parts.push(`链接类型：${linkType}`);
  }

  // Business Type 说明
  if (businessTypes.length > 0 && businessTypes[0] !== BusinessType.OTHER) {
    const typeNames = businessTypes.map(t => t.replace(/_/g, ' ')).join(', ');
    parts.push(`业务类型：${typeNames}`);
  }

  // 分数评级
  if (score >= 80) {
    parts.push('高质量机会');
  } else if (score >= 60) {
    parts.push('中等质量机会');
  } else if (score >= 40) {
    parts.push('低质量机会');
  } else {
    parts.push('不推荐');
  }

  return parts.join('，');
}
