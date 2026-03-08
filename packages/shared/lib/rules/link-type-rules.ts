/**
 * Link Type 识别规则
 */

import { LinkType } from '../types/enums.js';

/**
 * URL 模式规则
 */
export const URL_PATTERNS: Record<LinkType, RegExp[]> = {
  [LinkType.BLOG_COMMENT]: [
    /\/comment/i,
    /\/comments/i,
    /\/#comment/i,
    /\/#respond/i,
    /\/discussion/i,
  ],
  [LinkType.GUEST_POST]: [
    /\/guest-post/i,
    /\/write-for-us/i,
    /\/contribute/i,
    /\/submit-article/i,
  ],
  [LinkType.FORUM]: [
    /\/forum/i,
    /\/thread/i,
    /\/topic/i,
    /\/discussion/i,
    /\/community/i,
  ],
  [LinkType.DIRECTORY]: [
    /\/directory/i,
    /\/listing/i,
    /\/submit/i,
    /\/add-site/i,
  ],
  [LinkType.RESOURCE_PAGE]: [
    /\/resources/i,
    /\/tools/i,
    /\/links/i,
    /\/recommended/i,
  ],
  [LinkType.UNKNOWN]: [],
};

/**
 * 标题关键词规则
 */
export const TITLE_KEYWORDS: Record<LinkType, string[]> = {
  [LinkType.BLOG_COMMENT]: [
    'comment',
    'comments',
    'discussion',
    'leave a comment',
    'post a comment',
  ],
  [LinkType.GUEST_POST]: [
    'guest post',
    'write for us',
    'contribute',
    'submit article',
    'guest author',
  ],
  [LinkType.FORUM]: [
    'forum',
    'thread',
    'topic',
    'discussion board',
    'community',
  ],
  [LinkType.DIRECTORY]: [
    'directory',
    'listing',
    'submit site',
    'add website',
  ],
  [LinkType.RESOURCE_PAGE]: [
    'resources',
    'tools',
    'recommended',
    'useful links',
  ],
  [LinkType.UNKNOWN]: [],
};

/**
 * 锚文本关键词规则
 */
export const ANCHOR_KEYWORDS: Record<LinkType, string[]> = {
  [LinkType.BLOG_COMMENT]: [
    'comment',
    'reply',
    'said',
    'wrote',
  ],
  [LinkType.GUEST_POST]: [
    'guest post',
    'contributed by',
    'written by',
  ],
  [LinkType.FORUM]: [
    'forum',
    'thread',
    'post',
  ],
  [LinkType.DIRECTORY]: [
    'directory',
    'listing',
  ],
  [LinkType.RESOURCE_PAGE]: [
    'resource',
    'tool',
    'recommended',
  ],
  [LinkType.UNKNOWN]: [],
};

/**
 * 识别 Link Type
 */
export function identifyLinkType(url: string, title: string, anchor: string): LinkType {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const anchorLower = anchor.toLowerCase();

  // 按优先级检查每种类型
  const types = [
    LinkType.BLOG_COMMENT,
    LinkType.GUEST_POST,
    LinkType.FORUM,
    LinkType.DIRECTORY,
    LinkType.RESOURCE_PAGE,
  ];

  for (const type of types) {
    // 检查 URL 模式
    const urlMatches = URL_PATTERNS[type].some(pattern => pattern.test(urlLower));

    // 检查标题关键词
    const titleMatches = TITLE_KEYWORDS[type].some(keyword => titleLower.includes(keyword));

    // 检查锚文本关键词
    const anchorMatches = ANCHOR_KEYWORDS[type].some(keyword => anchorLower.includes(keyword));

    // 如果有任意两个匹配，则认为是该类型
    const matchCount = [urlMatches, titleMatches, anchorMatches].filter(Boolean).length;
    if (matchCount >= 2) {
      return type;
    }
  }

  // 如果只有一个匹配，也可以认为是该类型（置信度较低）
  for (const type of types) {
    const urlMatches = URL_PATTERNS[type].some(pattern => pattern.test(urlLower));
    const titleMatches = TITLE_KEYWORDS[type].some(keyword => titleLower.includes(keyword));
    const anchorMatches = ANCHOR_KEYWORDS[type].some(keyword => anchorLower.includes(keyword));

    if (urlMatches || titleMatches || anchorMatches) {
      return type;
    }
  }

  return LinkType.UNKNOWN;
}
