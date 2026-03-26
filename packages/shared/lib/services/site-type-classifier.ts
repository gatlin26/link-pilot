/**
 * 站点类型 AI 识别服务
 * MVP 阶段：纯规则推断，后续可扩展为 LLM 调用
 */

import type { LinkSiteType } from '@extension/shared';

const SITE_TYPE_PATTERNS: Array<{
  type: LinkSiteType;
  keywords: string[];
  pathPatterns: string[];
  score: number;
}> = [
  {
    type: LinkSiteType.BLOG_COMMENT,
    keywords: ['comment', 'blog', 'post a reply', 'leave a reply', 'trackback', 'pingback', 'article', 'post comment'],
    pathPatterns: ['/post/', '/article/', '/blog/', '/p/', '/entry/'],
    score: 3,
  },
  {
    type: LinkSiteType.DIRECTORY,
    keywords: ['submit', 'add site', 'add url', 'directory', 'listing', 'register', 'submit site'],
    pathPatterns: ['/submit', '/add', '/register', '/add-site', '/submit-url'],
    score: 3,
  },
  {
    type: LinkSiteType.AI_DIRECTORY,
    keywords: ['ai tools', 'ai directory', 'submit ai', 'ai software', 'chatgpt', 'llm', 'ai导航', 'ai工具'],
    pathPatterns: ['/ai-', '/ai/', '/tools/', '/submit'],
    score: 4,
  },
  {
    type: LinkSiteType.FORUM,
    keywords: ['forum', 'discussion', 'reply', 'thread', 'topic', 'community'],
    pathPatterns: ['/forum/', '/topic/', '/thread/', '/discuss', '/community/'],
    score: 3,
  },
  {
    type: LinkSiteType.GUEST_POST,
    keywords: ['guest post', 'write for us', 'contribute', 'submit article', 'author', 'guest article'],
    pathPatterns: ['/guest', '/write-for-us', '/contribute', '/submit-post'],
    score: 3,
  },
  {
    type: LinkSiteType.TOOL_SUBMISSION,
    keywords: ['tool', 'software', 'submit tool', 'add tool', 'tool listing', 'product'],
    pathPatterns: ['/tools/', '/submit-tool', '/add-tool', '/product/'],
    score: 3,
  },
  {
    type: LinkSiteType.SOCIAL_PROFILE,
    keywords: ['profile', 'about', 'bio', 'author', 'contact', 'social'],
    pathPatterns: ['/about', '/profile/', '/author/', '/user/'],
    score: 1,
  },
];

const classifySiteType = (function () {
  // eslint-disable-next-line func-style
  function impl(input: SiteAnalysisInput): { type: LinkSiteType; confidence: number; reason: string } {
    const { pageText, urlPath, formFields, ctaText, hasForm } = input;
    const combined = `${pageText} ${ctaText.join(' ')} ${formFields.join(' ')}`.toLowerCase();

    const scores: Record<string, number> = {};

    for (const pattern of SITE_TYPE_PATTERNS) {
      let score = 0;

      for (const pp of pattern.pathPatterns) {
        if (urlPath.toLowerCase().includes(pp)) {
          score += pattern.score;
          break;
        }
      }

      for (const kw of pattern.keywords) {
        if (combined.includes(kw)) {
          score += 1;
        }
      }

      if (hasForm && ['BLOG_COMMENT', 'DIRECTORY', 'GUEST_POST'].includes(pattern.type)) {
        score += 2;
      }

      scores[pattern.type] = score;
    }

    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestType, bestScore] = entries[0];

    const confidence = bestScore === 0 ? 0 : Math.min(bestScore / 10, 1);

    return {
      type: bestScore === 0 ? LinkSiteType.OTHER : (bestType as LinkSiteType),
      confidence,
      reason: bestScore === 0 ? '无法识别站点类型' : `基于 URL 路径和关键词匹配得分 ${bestScore}`,
    };
  }

  return impl;
})();

export interface SiteAnalysisInput {
  url: string;
  pageTitle: string;
  metaDescription?: string;
  pageText: string;
  hasForm: boolean;
  formFields: string[];
  ctaText: string[];
  urlPath: string;
}

export { classifySiteType };
