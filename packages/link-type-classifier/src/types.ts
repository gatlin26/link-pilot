/**
 * Link type classifier types
 */

/**
 * Link type categories
 */
export enum LinkType {
  BLOG = 'blog',
  SOCIAL = 'social',
  VIDEO = 'video',
  TOOL = 'tool',
  ECOMMERCE = 'ecommerce',
  NEWS = 'news',
  FORUM = 'forum',
  WIKI = 'wiki',
  QNA = 'qna',
  RESOURCE_PAGE = 'resource_page',
  OTHER = 'other',
}

/**
 * Classification result
 */
export interface ClassificationResult {
  url: string;
  linkType: LinkType;
  confidence: number;
  reasons: string[];
  checkedAt: string;
}

/**
 * Batch classification result
 */
export interface BatchClassificationResult {
  total: number;
  results: ClassificationResult[];
  breakdown: Record<LinkType, number>;
}

/**
 * Classifier configuration
 */
export interface ClassifierConfig {
  /** Whether to fetch page content for classification */
  fetchContent: boolean;
  /** Request timeout for content fetch */
  contentFetchTimeout: number;
  /** Minimum confidence threshold */
  minConfidence: number;
}
