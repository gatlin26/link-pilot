/**
 * 枚举类型定义
 */

/**
 * 数据来源平台
 */
export enum SourcePlatform {
  AHREFS = 'ahrefs',
}

/**
 * 外链类型
 */
export enum LinkType {
  BLOG_COMMENT = 'blog_comment',
  GUEST_POST = 'guest_post',
  FORUM = 'forum',
  DIRECTORY = 'directory',
  RESOURCE_PAGE = 'resource_page',
  UNKNOWN = 'unknown',
}

/**
 * 已收集外链状态
 */
export enum BacklinkStatus {
  COLLECTED = 'collected',
  SYNCED = 'synced',
  SYNC_FAILED = 'sync_failed',
  REVIEWED = 'reviewed',
  CONVERTED = 'converted',
  ARCHIVED = 'archived',
}

/**
 * 机会状态
 */
export enum OpportunityStatus {
  NEW = 'new',
  READY_TO_SUBMIT = 'ready_to_submit',
  SUBMITTED = 'submitted',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

/**
 * 提交结果
 */
export enum SubmissionResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  UNKNOWN = 'unknown',
}

/**
 * 提交模式
 */
export enum SubmitMode {
  MANUAL = 'manual',
  AUTO = 'auto',
}

/**
 * 同步操作类型
 */
export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
}

/**
 * 同步任务状态
 */
export enum SyncJobStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * 同步实体类型
 */
export enum SyncEntityType {
  BACKLINK = 'backlink',
  OPPORTUNITY = 'opportunity',
  TEMPLATE = 'template',
  SUBMISSION = 'submission',
}

/**
 * 业务类型
 */
export enum BusinessType {
  AI_TOOLS = 'ai_tools',
  SEO = 'seo',
  SAAS = 'saas',
  MARKETING = 'marketing',
  DEVELOPMENT = 'development',
  DESIGN = 'design',
  PRODUCTIVITY = 'productivity',
  ECOMMERCE = 'ecommerce',
  CONTENT = 'content',
  ANALYTICS = 'analytics',
  OTHER = 'other',
}

/**
 * 页面类型
 */
export enum PageType {
  BLOG_POST = 'blog_post',
  BLOG_COMMENT = 'blog_comment',
  ARTICLE = 'article',
  FORUM_THREAD = 'forum_thread',
  DIRECTORY_LISTING = 'directory_listing',
  RESOURCE_LIST = 'resource_list',
  UNKNOWN = 'unknown',
}

/**
 * 递归队列状态
 */
export enum RecursiveQueueStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * 递归会话状态
 */
export enum RecursiveSessionStatus {
  INITIALIZED = 'initialized',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  STOPPED = 'stopped',
  FAILED = 'failed',
}

/**
 * 递归策略
 */
export enum RecursiveStrategy {
  DEPTH_FIRST = 'depth_first',
  BREADTH_FIRST = 'breadth_first',
}

/**
 * 去重策略
 */
export enum DeduplicationStrategy {
  URL_LEVEL = 'url_level',
  DOMAIN_LEVEL = 'domain_level',
  HYBRID = 'hybrid',
}

/**
 * 外链可用性状态
 */
export enum LinkAvailabilityStatus {
  UNKNOWN = 'unknown',
  CHECKING = 'checking',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
}

/**
 * 站点类型（AI 推荐值，可扩展）
 */
export enum LinkSiteType {
  BLOG_COMMENT = 'blog_comment',
  DIRECTORY = 'directory',
  AI_DIRECTORY = 'ai_directory',
  FORUM = 'forum',
  SOCIAL_PROFILE = 'social_profile',
  GUEST_POST = 'guest_post',
  TOOL_SUBMISSION = 'tool_submission',
  OTHER = 'other',
}
