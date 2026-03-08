/**
 * 业务规则常量
 */

import { LinkType, SourcePlatform } from '../types/enums.js';

/**
 * V1 版本支持的数据源
 */
export const SUPPORTED_PLATFORMS = [SourcePlatform.AHREFS] as const;

/**
 * V1 版本支持的提交类型
 */
export const SUPPORTED_SUBMIT_TYPES = [LinkType.BLOG_COMMENT] as const;

/**
 * 机会池准入规则
 */
export const OPPORTUNITY_ADMISSION_RULES = {
  /**
   * 必须是支持的链接类型
   */
  requiredLinkType: LinkType.BLOG_COMMENT,

  /**
   * 最低上下文匹配分数
   */
  minContextMatchScore: 60,

  /**
   * 允许人工强制入池
   */
  allowManualOverride: true,
} as const;

/**
 * 去重规则
 */
export const DEDUPLICATION_RULES = {
  /**
   * 主键字段
   */
  primaryKey: 'target_url' as const,

  /**
   * 是否区分大小写
   */
  caseSensitive: false,

  /**
   * URL 规范化规则
   */
  normalizeUrl: {
    removeTrailingSlash: true,
    removeQueryParams: false,
    removeHash: true,
    lowercaseProtocol: true,
    lowercaseDomain: true,
  },
} as const;

/**
 * 同步策略
 */
export const SYNC_STRATEGY = {
  /**
   * 批量同步大小
   */
  batchSize: 50,

  /**
   * 最大重试次数
   */
  maxRetries: 3,

  /**
   * 重试延迟（毫秒）
   */
  retryDelay: 5000,

  /**
   * raw_snapshot 最大大小（字节）
   */
  maxSnapshotSize: 5 * 1024, // 5KB

  /**
   * 同步所有字段
   */
  syncAllFields: true,
} as const;

/**
 * 收集规则
 */
export const COLLECTION_RULES = {
  /**
   * 默认收集数量选项
   */
  defaultCounts: [10, 20] as const,

  /**
   * 最大收集数量
   */
  maxCount: 20,

  /**
   * 批次 ID 格式
   */
  batchIdFormat: 'batch_{timestamp}_{random}' as const,
} as const;

/**
 * 字段长度限制
 */
export const FIELD_LENGTH_LIMITS = {
  url: 2048,
  domain: 255,
  title: 500,
  anchorText: 200,
  siteSummary: 500,
  contextMatchNote: 1000,
  notes: 2000,
  commentExcerpt: 500,
  errorMessage: 1000,
  pathPattern: 255,
} as const;

/**
 * 提交规则
 */
export const SUBMISSION_RULES = {
  /**
   * 默认不自动点击提交按钮
   */
  autoSubmitByDefault: false,

  /**
   * 需要人工确认
   */
  requireManualConfirmation: true,

  /**
   * 批量处理间隔（毫秒）
   */
  batchProcessInterval: 3000,
} as const;

/**
 * 模板规则
 */
export const TEMPLATE_RULES = {
  /**
   * 模板匹配优先级
   */
  matchPriority: ['domain', 'page_type', 'path_pattern'] as const,

  /**
   * 支持版本更新
   */
  allowVersionUpdate: true,

  /**
   * 初始版本号
   */
  initialVersion: 1,
} as const;
