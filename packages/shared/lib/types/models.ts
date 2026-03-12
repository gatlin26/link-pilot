/**
 * 数据模型定义
 */

import {
  BacklinkStatus,
  BusinessType,
  LinkType,
  OpportunityStatus,
  PageType,
  SourcePlatform,
  SubmissionResult,
  SubmitMode,
  SyncEntityType,
  SyncJobStatus,
  SyncOperation,
  RecursiveQueueStatus,
  RecursiveSessionStatus,
  RecursiveStrategy,
  DeduplicationStrategy,
} from './enums.js';

/**
 * 已收集外链
 */
export interface CollectedBacklink {
  /** 唯一标识 */
  id: string;

  /** 数据来源平台 */
  source_platform: SourcePlatform;

  /** 收集批次 ID */
  collection_batch_id: string;

  /** 外链分组 ID */
  backlink_group_id?: string;

  /** 收集时间 */
  collected_at: string;

  /** 目标域名 */
  target_domain: string;

  /** 目标 URL */
  target_url: string;

  /** 引用页面 URL */
  referring_page_url: string;

  /** 引用域名 */
  referring_domain: string;

  /** 锚文本 */
  anchor_text: string;

  /** 页面标题 */
  page_title: string;

  /** 原始指标数据 */
  raw_metrics: Record<string, unknown>;

  /** 原始快照（限制 5KB） */
  raw_snapshot: string;

  /** 站点摘要 */
  site_summary?: string;

  /** 链接类型 */
  link_type?: LinkType;

  /** 站点业务类型 */
  site_business_types?: BusinessType[];

  /** 上下文匹配分数 */
  context_match_score?: number;

  /** 上下文匹配说明 */
  context_match_note?: string;

  /** 状态 */
  status: BacklinkStatus;

  /** 备注 */
  notes?: string;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}

/**
 * 机会
 */
export interface Opportunity {
  /** 唯一标识 */
  id: string;

  /** 关联的已收集外链 ID */
  collected_backlink_id: string;

  /** 目标 URL */
  url: string;

  /** 域名 */
  domain: string;

  /** 页面类型 */
  page_type: PageType;

  /** 路径模式 */
  path_pattern: string;

  /** 链接类型 */
  link_type: LinkType;

  /** 站点摘要 */
  site_summary: string;

  /** 站点业务类型 */
  site_business_types: BusinessType[];

  /** 上下文匹配分数 */
  context_match_score: number;

  /** 上下文匹配说明 */
  context_match_note: string;

  /** 是否可提交 */
  can_submit: boolean;

  /** 是否可自动填充 */
  can_auto_fill: boolean;

  /** 是否可自动提交 */
  can_auto_submit: boolean;

  /** 状态 */
  status: OpportunityStatus;

  /** 备注 */
  notes?: string;

  /** 转化后的外链 ID（status 为 converted 时设置） */
  converted_backlink_id?: string;

  /** 丢弃原因（status 为 discarded 时可设置） */
  discard_reason?: string;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}

/**
 * 表单字段映射
 */
export interface FieldMapping {
  /** 字段类型 */
  field_type: 'name' | 'email' | 'website' | 'comment' | 'submit';

  /** 选择器 */
  selector: string;

  /** 是否必填 */
  required: boolean;

  /** 默认值 */
  default_value?: string;
}

/**
 * 站点模板
 */
export interface SiteTemplate {
  /** 唯一标识 */
  id: string;

  /** 域名 */
  domain: string;

  /** 页面类型 */
  page_type: PageType;

  /** 路径模式 */
  path_pattern: string;

  /** 字段映射 */
  field_mappings: FieldMapping[];

  /** 提交按钮选择器 */
  submit_selector: string;

  /** 版本号 */
  version: number;

  /** 更新时间 */
  updated_at: string;

  /** 学习来源 */
  learning_source?: 'auto' | 'user_assisted';

  /** 使用次数 */
  usage_count?: number;

  /** 成功次数 */
  success_count?: number;

  /** 最后使用时间 */
  last_used_at?: string;

  /** 模板置信度 */
  confidence_score?: number;
}

/**
 * 提交记录
 */
export interface Submission {
  /** 唯一标识 */
  id: string;

  /** 关联的机会 ID */
  opportunity_id: string;

  /** 域名 */
  domain: string;

  /** 页面 URL */
  page_url: string;

  /** 提交模式 */
  submit_mode: SubmitMode;

  /** 是否点击了提交按钮 */
  did_click_submit: boolean;

  /** 提交结果 */
  result: SubmissionResult;

  /** 评论摘要 */
  comment_excerpt: string;

  /** 错误信息 */
  error_message?: string;

  /** 创建时间 */
  created_at: string;
}

/**
 * 同步任务
 */
export interface SyncJob {
  /** 唯一标识 */
  id: string;

  /** 实体类型 */
  entity_type: SyncEntityType;

  /** 实体 ID */
  entity_id: string;

  /** 操作类型 */
  operation: SyncOperation;

  /** 状态 */
  status: SyncJobStatus;

  /** 重试次数 */
  retry_count: number;

  /** 错误信息 */
  error_message?: string;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}

/**
 * 收集批次信息
 */
export interface CollectionBatch {
  /** 批次 ID */
  id: string;

  /** 数据来源平台 */
  source_platform: SourcePlatform;

  /** 收集数量 */
  count: number;

  /** 收集时间 */
  collected_at: string;

  /** 同步状态 */
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed';

  /** 同步成功数量 */
  synced_count: number;
}

/**
 * 页面上下文
 */
export interface PageContext {
  /** 机会 ID */
  opportunity_id: string;

  /** 域名 */
  domain: string;

  /** 链接类型 */
  link_type: LinkType;

  /** 是否启用自动填充 */
  auto_fill_enabled: boolean;

  /** 是否启用自动提交 */
  auto_submit_enabled: boolean;

  /** 标签页 ID */
  tab_id?: number;

  /** 创建时间 */
  created_at: string;
}

/**
 * 网站配置
 */
export interface WebsiteConfig {
  /** 唯一标识 */
  id: string;

  /** 网站名称 */
  name: string;

  /** 网站 URL */
  url: string;

  /** 网站域名 */
  domain: string;

  /** 分组 ID */
  group_id: string;

  /** 分类 */
  categories: string[];

  /** 网站描述 */
  description?: string;

  /** 关键词 */
  keywords?: string[];

  /** 是否启用 */
  enabled: boolean;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}

/**
 * 网站分组
 */
export interface WebsiteGroup {
  /** 分组 ID */
  id: string;

  /** 分组名称 */
  name: string;

  /** 网站数量 */
  website_count: number;

  /** 创建时间 */
  created_at: string;
}

/**
 * 外链分组
 */
export interface BacklinkGroup {
  /** 分组 ID */
  id: string;

  /** 分组名称 */
  name: string;

  /** 外链数量 */
  backlink_count: number;

  /** 创建时间 */
  created_at: string;
}

/**
 * 扩展设置
 */
export interface ExtensionSettings {
  /** 自动检测表单 */
  auto_detect_form: boolean;

  /** 自动开始填充 */
  auto_start_fill: boolean;

  /** 下一个外链打开数量 */
  next_backlink_count: number;

  /** 外链域名唯一 */
  unique_backlink_domain: boolean;

  /** 显示手动填充提示（MVP 中未启用页面侧边提示时保持 false） */
  show_manual_fill_hints: boolean;

  /** 自动填充的置信度阈值 */
  auto_fill_confidence_threshold?: number;

  /** 提示用户的置信度阈值 */
  prompt_confidence_threshold?: number;

  /** 启用用户辅助学习 */
  enable_assisted_learning?: boolean;

  /** 显示字段映射预览 */
  show_field_mapping_preview?: boolean;

  /** 填充后自动保存模板 */
  auto_save_template_after_fill?: boolean;
}

/**
 * MVP 网站资料
 */
export interface WebsiteProfile {
  id: string;
  group_id: string;
  name: string;
  url: string;
  domain: string;
  email: string;
  author_name?: string;
  author_email?: string;
  comments: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * MVP 网站分组
 */
export interface WebsiteProfileGroup {
  id: string;
  name: string;
  website_count: number;
  created_at: string;
}

/**
 * MVP 管理外链
 */
export interface ManagedBacklink {
  id: string;
  group_id: string;
  url: string;
  domain: string;
  note?: string;
  keywords: string[];
  dr?: number;
  as?: number;
  flagged: boolean;

  /** 来源 Opportunity ID（per_url 模式使用） */
  source_opportunity_id?: string;

  /** 来源 Opportunity ID 列表（per_domain 模式使用） */
  source_opportunity_ids?: string[];

  /** 提交模式：per_url（每URL独立提交）或 per_domain（整个域名一个入口） */
  submission_mode?: 'per_url' | 'per_domain';

  /** per_domain 模式下的实际提交页面URL */
  submit_page_url?: string;

  created_at: string;
  updated_at: string;
}

/**
 * MVP 外链分组
 */
export interface ManagedBacklinkGroup {
  id: string;
  name: string;
  backlink_count: number;
  created_at: string;
}

/**
 * MVP 提交会话
 */
export interface SubmissionSession {
  selected_website_id?: string;
  selected_website_group_id?: string;
  selected_backlink_group_id?: string;
  current_backlink_id?: string;
  queue_backlink_ids: string[];
  queue_cursor: number;
  last_opened_at?: string;
}

/**
 * 当前页面 SEO 摘要
 */
export interface FillPageSeoSummary {
  title: string;
  description: string;
  h1: string;
  language: string;
  url: string;
}

/**
 * 当前页面填表状态
 */
export interface FillPageState {
  seo: FillPageSeoSummary;
  form_detected: boolean;
  form_confidence: number;
  field_types: Array<'name' | 'email' | 'website' | 'comment' | 'submit'>;
  backlink_in_current_group: boolean;
  selected_website_link_present: boolean;
}

/**
 * 站点过滤规则
 */
export interface SiteFilterRule {
  id: string;
  name: string;
  business_types?: BusinessType[];
  domain_patterns?: string[];
  deduplication_level: 'url' | 'domain';
  enabled: boolean;
}

/**
 * 递归采集配置
 */
export interface RecursiveCollectionConfig {
  max_depth: number;
  max_links_per_url: number;
  max_total_urls: number;
  collection_interval_ms: number;
  max_retries: number;
  deduplication: DeduplicationStrategy;
  site_filters: SiteFilterRule[];
  auto_pause_on_limit: boolean;
  target_group_id?: string;
}

/**
 * 递归采集统计信息
 */
export interface RecursiveCollectionStats {
  total_urls: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  total_backlinks_collected: number;
  total_backlinks_added: number;
  total_opportunities: number;
  current_depth: number;
  max_depth_reached: number;
  by_depth: Record<
    number,
    {
      total: number;
      completed: number;
      failed: number;
    }
  >;
}

/**
 * 递归队列项
 */
export interface RecursiveQueueItem {
  id: string;
  url: string;
  domain: string;
  depth: number;
  parent_id: string | null;
  status: RecursiveQueueStatus;
  collected_count?: number;
  retry_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * 递归采集会话
 */
export interface RecursiveCollectionSession {
  id: string;
  initial_url: string;
  strategy: RecursiveStrategy;
  max_depth: number;
  max_links_per_url: number;
  status: RecursiveSessionStatus;
  config: RecursiveCollectionConfig;
  stats: RecursiveCollectionStats;
  created_at: string;
  updated_at: string;
  started_at?: string;
  paused_at?: string;
  completed_at?: string;
}

/**
 * 表单填充数据
 */
export interface FillData {
  name?: string;
  email?: string;
  website?: string;
  comment?: string;
}

/**
 * 表单填充结果
 */
export interface FillResult {
  /** 是否成功 */
  success: boolean;
  /** 已填充的字段 */
  filledFields: string[];
  /** 失败的字段 */
  failedFields: string[];
  /** 错误信息 */
  error?: string;
}

/**
 * 填充决策行为类型
 */
export type AutoFillBehavior = 'auto_fill' | 'prompt_user' | 'skip';

/**
 * 置信度等级
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * 填充决策
 */
export interface FillDecision {
  /** 建议的行为 */
  behavior: AutoFillBehavior;
  /** 置信度等级 */
  confidenceLevel: ConfidenceLevel;
  /** 置信度分数 */
  confidence: number;
  /** 是否应该自动填充 */
  shouldAutoFill: boolean;
  /** 是否应该提示用户 */
  shouldPromptUser: boolean;
}

/**
 * 提交任务状态
 */
export type SubmissionTaskStatus = 'pending' | 'in_progress' | 'waiting_confirmation' | 'completed' | 'failed' | 'paused';

/**
 * 提交任务
 */
export interface SubmissionTask {
  id: string;
  backlinkId: string;
  url: string;
  domain: string;
  // 关键：存储 website_profile_id 而不是 FillData
  websiteProfileId: string;
  // 存储评论生成所需的上下文
  context: {
    backlinkNote?: string;
    backlinkKeywords?: string[];
  };
  status: SubmissionTaskStatus;
  retryCount: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastAttemptAt?: string;
}

/**
 * 队列事件
 */
export interface QueueEvent {
  type: 'task_added' | 'task_started' | 'task_waiting_confirmation' | 'task_completed' | 'task_failed' | 'queue_paused' | 'queue_resumed' | 'queue_cleared' | 'queue_stopped' | 'progress';
  taskId?: string;
  timestamp: string;
  data?: unknown;
}
