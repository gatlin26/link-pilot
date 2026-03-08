/**
 * Business Type 识别规则
 */

import { BusinessType } from '../types/enums.js';

/**
 * 业务类型关键词映射
 */
export const BUSINESS_TYPE_KEYWORDS: Record<BusinessType, string[]> = {
  [BusinessType.AI_TOOLS]: [
    'ai',
    'artificial intelligence',
    'machine learning',
    'ml',
    'deep learning',
    'neural network',
    'chatgpt',
    'gpt',
    'llm',
    'generative ai',
    'ai tool',
    'ai assistant',
  ],
  [BusinessType.SEO]: [
    'seo',
    'search engine optimization',
    'keyword',
    'backlink',
    'rank',
    'serp',
    'google',
    'search',
    'organic traffic',
    'link building',
  ],
  [BusinessType.SAAS]: [
    'saas',
    'software as a service',
    'cloud',
    'subscription',
    'platform',
    'app',
    'software',
  ],
  [BusinessType.MARKETING]: [
    'marketing',
    'digital marketing',
    'content marketing',
    'email marketing',
    'social media',
    'advertising',
    'campaign',
    'conversion',
  ],
  [BusinessType.DEVELOPMENT]: [
    'development',
    'developer',
    'coding',
    'programming',
    'api',
    'framework',
    'library',
    'github',
    'code',
  ],
  [BusinessType.DESIGN]: [
    'design',
    'ui',
    'ux',
    'graphic',
    'designer',
    'figma',
    'sketch',
    'adobe',
  ],
  [BusinessType.PRODUCTIVITY]: [
    'productivity',
    'task',
    'project management',
    'collaboration',
    'workflow',
    'automation',
    'efficiency',
  ],
  [BusinessType.ECOMMERCE]: [
    'ecommerce',
    'e-commerce',
    'online store',
    'shop',
    'shopping',
    'cart',
    'checkout',
    'payment',
  ],
  [BusinessType.CONTENT]: [
    'content',
    'blog',
    'article',
    'writing',
    'copywriting',
    'editor',
    'cms',
  ],
  [BusinessType.ANALYTICS]: [
    'analytics',
    'data',
    'metrics',
    'tracking',
    'statistics',
    'insights',
    'reporting',
  ],
  [BusinessType.OTHER]: [],
};

/**
 * 域名关键词映射（用于从域名推断业务类型）
 */
export const DOMAIN_KEYWORDS: Record<BusinessType, string[]> = {
  [BusinessType.AI_TOOLS]: ['ai', 'gpt', 'chat', 'bot'],
  [BusinessType.SEO]: ['seo', 'rank', 'search', 'keyword'],
  [BusinessType.SAAS]: ['app', 'cloud', 'software'],
  [BusinessType.MARKETING]: ['marketing', 'ads', 'campaign'],
  [BusinessType.DEVELOPMENT]: ['dev', 'code', 'git', 'api'],
  [BusinessType.DESIGN]: ['design', 'ui', 'ux'],
  [BusinessType.PRODUCTIVITY]: ['task', 'project', 'todo'],
  [BusinessType.ECOMMERCE]: ['shop', 'store', 'cart'],
  [BusinessType.CONTENT]: ['blog', 'content', 'cms'],
  [BusinessType.ANALYTICS]: ['analytics', 'stats', 'data'],
  [BusinessType.OTHER]: [],
};

/**
 * 提取关键词
 */
export function extractKeywords(text: string): string[] {
  // 转小写
  const lower = text.toLowerCase();

  // 移除特殊字符，保留字母、数字、空格
  const cleaned = lower.replace(/[^a-z0-9\s]/g, ' ');

  // 分词
  const words = cleaned.split(/\s+/).filter(word => word.length > 2);

  // 去重
  return Array.from(new Set(words));
}

/**
 * 识别业务类型
 */
export function identifyBusinessTypes(url: string, title: string, anchorText: string): BusinessType[] {
  const allText = `${url} ${title} ${anchorText}`;
  const keywords = extractKeywords(allText);

  const scores: Record<BusinessType, number> = {
    [BusinessType.AI_TOOLS]: 0,
    [BusinessType.SEO]: 0,
    [BusinessType.SAAS]: 0,
    [BusinessType.MARKETING]: 0,
    [BusinessType.DEVELOPMENT]: 0,
    [BusinessType.DESIGN]: 0,
    [BusinessType.PRODUCTIVITY]: 0,
    [BusinessType.ECOMMERCE]: 0,
    [BusinessType.CONTENT]: 0,
    [BusinessType.ANALYTICS]: 0,
    [BusinessType.OTHER]: 0,
  };

  // 计算每种业务类型的匹配分数
  for (const [type, typeKeywords] of Object.entries(BUSINESS_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (typeKeywords.some(tk => keyword.includes(tk) || tk.includes(keyword))) {
        scores[type as BusinessType] += 1;
      }
    }

    // 域名关键词权重更高
    const domainKeywords = DOMAIN_KEYWORDS[type as BusinessType];
    for (const keyword of keywords) {
      if (domainKeywords.some(dk => keyword.includes(dk) || dk.includes(keyword))) {
        scores[type as BusinessType] += 2;
      }
    }
  }

  // 选择分数最高的类型（至少需要 1 分）
  const results: BusinessType[] = [];
  const sortedTypes = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort(([_, a], [__, b]) => b - a)
    .map(([type]) => type as BusinessType);

  // 最多返回 3 个业务类型
  results.push(...sortedTypes.slice(0, 3));

  // 如果没有匹配，返回 OTHER
  if (results.length === 0) {
    results.push(BusinessType.OTHER);
  }

  return results;
}
