/**
 * Link type classifier implementation
 * Classifies URLs based on domain patterns, URL paths, and content analysis
 */

import type { ClassificationResult, ClassifierConfig, LinkType } from './types';
import { LinkType as LinkTypeEnum } from './types';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ClassifierConfig = {
  fetchContent: false,
  contentFetchTimeout: 10000,
  minConfidence: 0.5,
};

/**
 * Domain pattern mappings - P0 (highest priority)
 */
const DOMAIN_PATTERNS: Record<LinkType, RegExp[]> = {
  [LinkTypeEnum.VIDEO]: [
    /youtube\.com$/i,
    /youtu\.be$/i,
    /vimeo\.com$/i,
    /bilibili\.com$/i,
    /dailymotion\.com$/i,
    /twitch\.tv$/i,
    /tiktok\.com$/i,
    /vine\.co$/i,
    /metacafe\.com$/i,
    /funnyordie\.com$/i,
  ],
  [LinkTypeEnum.SOCIAL]: [
    /twitter\.com$/i,
    /x\.com$/i,
    /facebook\.com$/i,
    /instagram\.com$/i,
    /linkedin\.com$/i,
    /reddit\.com$/i,
    /pinterest\.com$/i,
    /tumblr\.com$/i,
    /weibo\.com$/i,
    /snapchat\.com$/i,
    /threads\.net$/i,
    /mastodon\.social$/i,
  ],
  [LinkTypeEnum.ECOMMERCE]: [
    /amazon\./i,
    /ebay\.com$/i,
    /aliexpress\.com$/i,
    /taobao\.com$/i,
    /jd\.com$/i,
    /shopify\.com$/i,
    /etsy\.com$/i,
    /walmart\.com$/i,
    /bestbuy\.com$/i,
    /target\.com$/i,
    /aliexpress\.com$/i,
  ],
  [LinkTypeEnum.NEWS]: [
    /cnn\.com$/i,
    /bbc\.com$/i,
    /nytimes\.com$/i,
    /reuters\.com$/i,
    /bloomberg\.com$/i,
    /theguardian\.com$/i,
    /washingtonpost\.com$/i,
    /forbes\.com$/i,
    /wsj\.com$/i,
    /news\./i,
    /press\./i,
  ],
  [LinkTypeEnum.FORUM]: [
    /forum\./i,
    /board\./i,
    /discussion\./i,
    /discourse\./i,
    /phpbb\./i,
    /vbulletin\./i,
    /smf\./i,
  ],
  [LinkTypeEnum.BLOG]: [
    /medium\.com$/i,
    /blogspot\.com$/i,
    /wordpress\.com$/i,
    /ghost\./i,
    /substack\.com$/i,
    /dev\.to$/i,
    /hashnode\.dev$/i,
    /blog\./i,
    /techcrunch\.com$/i,
  ],
  [LinkTypeEnum.TOOL]: [
    /canva\.com$/i,
    /figma\.com$/i,
    /miro\.com$/i,
    /notion\.so$/i,
    /airtable\.com$/i,
    /typeform\.com$/i,
    /calendly\.com$/i,
    /zoom\.us$/i,
    /docs\.google\.com$/i,
    /sheets\.google\.com$/i,
  ],
  [LinkTypeEnum.WIKI]: [
    /wikipedia\.org$/i,
    /wikia\.com$/i,
    /wikihow\.com$/i,
    /wiki\./i,
  ],
  [LinkTypeEnum.QNA]: [
    /stackoverflow\.com$/i,
    /quora\.com$/i,
    /answers\.yahoo\.com$/i,
    /zhihu\.com$/i,
    /stackexchange\.com$/i,
    /askubuntu\.com$/i,
    /superuser\.com$/i,
  ],
  [LinkTypeEnum.RESOURCE_PAGE]: [
    /resources?\./i,
    /links?\./i,
    /recommended\./i,
    /directory\./i,
    /collection\./i,
  ],
  [LinkTypeEnum.OTHER]: [],
};

/**
 * URL path patterns - P0 (secondary priority)
 */
const PATH_PATTERNS: Record<LinkType, RegExp[]> = {
  [LinkTypeEnum.BLOG]: [
    /^\/blog\//i,
    /^\/post\//i,
    /^\/article\//i,
    /^\/p\//i,
    /^\/20\d{2}\/\d{2}\//i, // Date paths like /2024/03/
    /^\/posts\//i,
  ],
  [LinkTypeEnum.FORUM]: [
    /^\/forum\//i,
    /^\/thread\//i,
    /^\/topic\//i,
    /^\/t\//i, // Short paths like /t/12345
    /^\/discussion\//i,
    /^\/replies\//i,
  ],
  [LinkTypeEnum.VIDEO]: [
    /^\/watch\//i,
    /^\/v\//i,
    /^\/embed\//i,
    /^\/video\//i,
    /^\/blended\//i,
    /^\/shorts\//i,
  ],
  [LinkTypeEnum.NEWS]: [
    /^\/news\//i,
    /^\/article\//i,
    /^\/breaking\//i,
    /^\/story\//i,
  ],
  [LinkTypeEnum.ECOMMERCE]: [
    /^\/product\//i,
    /^\/item\//i,
    /^\/dp\//i,
    /^\/shop\//i,
    /^\/cart\//i,
    /^\/checkout\//i,
    /^\/buy\//i,
  ],
  [LinkTypeEnum.RESOURCE_PAGE]: [
    /^\/resources\//i,
    /^\/links\//i,
    /^\/recommended\//i,
    /^\/tools\//i,
    /^\/directory\//i,
    /^\/collection\//i,
  ],
  [LinkTypeEnum.SOCIAL]: [
    /^\/profile\//i,
    /^\/user\//i,
    /^\/status\//i,
    /^\/post\//i,
  ],
  [LinkTypeEnum.TOOL]: [
    /^\/app\//i,
    /^\/tool\//i,
    /^\/generator\//i,
    /^\/calculator\//i,
    /^\/create\//i,
  ],
  [LinkTypeEnum.WIKI]: [
    /^\/wiki\//i,
    /^\/help\//i,
    /^\/docs\//i,
  ],
  [LinkTypeEnum.QNA]: [
    /^\/questions?\//i,
    /^\/answers?\//i,
    /^\/q\//i,
  ],
  [LinkTypeEnum.OTHER]: [],
};

/**
 * Content keywords - P1 (fallback when content is available)
 */
const CONTENT_KEYWORDS: Record<LinkType, string[]> = {
  [LinkTypeEnum.BLOG]: [
    'written by',
    'author',
    'published',
    'blog post',
    'comment section',
    'read more',
    'subscribe',
  ],
  [LinkTypeEnum.SOCIAL]: [
    'follow us',
    'share this',
    'like',
    'friend request',
    'connect',
    'followers',
  ],
  [LinkTypeEnum.VIDEO]: [
    'watch video',
    'subscribe',
    'views',
    'duration',
    'likes',
    'dislikes',
    'channel',
  ],
  [LinkTypeEnum.TOOL]: [
    'free tool',
    'generator',
    'calculator',
    'create your own',
    'no signup',
    'online tool',
  ],
  [LinkTypeEnum.ECOMMERCE]: [
    'add to cart',
    'buy now',
    'price',
    'checkout',
    'shipping',
    'payment',
    'discount',
  ],
  [LinkTypeEnum.NEWS]: [
    'breaking news',
    'reported that',
    'according to',
    'press release',
    'exclusive',
  ],
  [LinkTypeEnum.FORUM]: [
    'replied to',
    'topic',
    'moderator',
    'registered users',
    'replies',
    'views',
  ],
  [LinkTypeEnum.WIKI]: [
    'from wikipedia',
    'encyclopedia',
    'citation needed',
    'article',
    'references',
  ],
  [LinkTypeEnum.QNA]: [
    'answered',
    'question',
    'best answer',
    'votes',
    'asked',
    'accepted answer',
  ],
  [LinkTypeEnum.RESOURCE_PAGE]: [
    'resources',
    'helpful links',
    'recommended',
    'useful links',
    'collection',
  ],
  [LinkTypeEnum.OTHER]: [],
};

/**
 * Link Type Classifier
 */
export class LinkTypeClassifier {
  private config: ClassifierConfig;

  constructor(config: Partial<ClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify a single URL
   */
  async classify(url: string, content?: string): Promise<ClassificationResult> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return this.createUnknownResult(url, 'Invalid URL format');
    }

    const domain = parsedUrl.hostname;
    const path = parsedUrl.pathname;

    // 1. Domain pattern matching (P0 - highest priority)
    const domainMatch = this.matchDomain(domain);
    if (domainMatch) {
      return {
        url,
        linkType: domainMatch.type,
        confidence: 0.95,
        reasons: [`Domain matches: ${domain}`],
        checkedAt: new Date().toISOString(),
      };
    }

    // 2. URL path pattern matching (P0 - secondary)
    const pathMatch = this.matchPath(path);
    if (pathMatch) {
      return {
        url,
        linkType: pathMatch.type,
        confidence: 0.85,
        reasons: [`URL path matches: ${path}`],
        checkedAt: new Date().toISOString(),
      };
    }

    // 3. Content analysis (P1 - fallback)
    if (content) {
      const contentMatch = this.analyzeContent(content);
      if (contentMatch.score > 0) {
        return {
          url,
          linkType: contentMatch.type,
          confidence: contentMatch.confidence,
          reasons: [`Content analysis: ${contentMatch.score} keywords matched`],
          checkedAt: new Date().toISOString(),
        };
      }
    }

    // 4. Default to other
    return {
      url,
      linkType: LinkTypeEnum.OTHER,
      confidence: 0.0,
      reasons: ['Unable to classify based on available information'],
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Match domain against patterns
   */
  private matchDomain(domain: string): { type: LinkType; pattern: string } | null {
    for (const [linkType, patterns] of Object.entries(DOMAIN_PATTERNS)) {
      if (linkType === LinkTypeEnum.OTHER) continue;
      for (const pattern of patterns) {
        if (pattern.test(domain)) {
          return { type: linkType as LinkType, pattern: pattern.source };
        }
      }
    }
    return null;
  }

  /**
   * Match URL path against patterns
   */
  private matchPath(path: string): { type: LinkType; pattern: string } | null {
    for (const [linkType, patterns] of Object.entries(PATH_PATTERNS)) {
      if (linkType === LinkTypeEnum.OTHER) continue;
      for (const pattern of patterns) {
        if (pattern.test(path)) {
          return { type: linkType as LinkType, pattern: pattern.source };
        }
      }
    }
    return null;
  }

  /**
   * Analyze page content
   */
  private analyzeContent(
    content: string
  ): { type: LinkType; score: number; confidence: number } {
    const text = content.toLowerCase();
    const scores: Record<LinkType, number> = {
      [LinkTypeEnum.BLOG]: 0,
      [LinkTypeEnum.SOCIAL]: 0,
      [LinkTypeEnum.VIDEO]: 0,
      [LinkTypeEnum.TOOL]: 0,
      [LinkTypeEnum.ECOMMERCE]: 0,
      [LinkTypeEnum.NEWS]: 0,
      [LinkTypeEnum.FORUM]: 0,
      [LinkTypeEnum.WIKI]: 0,
      [LinkTypeEnum.QNA]: 0,
      [LinkTypeEnum.RESOURCE_PAGE]: 0,
      [LinkTypeEnum.OTHER]: 0,
    };

    // Count keyword matches
    for (const [linkType, keywords] of Object.entries(CONTENT_KEYWORDS)) {
      if (linkType === LinkTypeEnum.OTHER) continue;
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          scores[linkType as LinkType]++;
        }
      }
    }

    // Find the highest scoring type
    let maxType = LinkTypeEnum.OTHER;
    let maxScore = 0;
    for (const [linkType, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = linkType as LinkType;
      }
    }

    // Calculate confidence
    const confidence = maxScore > 0 ? Math.min(0.7, 0.2 + maxScore * 0.1) : 0.0;

    return { type: maxType, score: maxScore, confidence };
  }

  /**
   * Create unknown result
   */
  private createUnknownResult(url: string, reason: string): ClassificationResult {
    return {
      url,
      linkType: LinkTypeEnum.OTHER,
      confidence: 0.0,
      reasons: [reason],
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): ClassifierConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClassifierConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a classifier instance
 */
export function createClassifier(config?: Partial<ClassifierConfig>): LinkTypeClassifier {
  return new LinkTypeClassifier(config);
}
