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
