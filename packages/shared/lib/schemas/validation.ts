/**
 * Zod 验证 Schema
 */

import { z } from 'zod';
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
} from '../types/enums.js';
import { FIELD_LENGTH_LIMITS, SYNC_STRATEGY } from '../rules/business-rules.js';

/**
 * 已收集外链 Schema
 */
export const CollectedBacklinkSchema = z.object({
  id: z.string().uuid(),
  source_platform: z.nativeEnum(SourcePlatform),
  collection_batch_id: z.string(),
  collected_at: z.string().datetime(),
  target_domain: z.string().max(FIELD_LENGTH_LIMITS.domain),
  target_url: z.string().url().max(FIELD_LENGTH_LIMITS.url),
  referring_page_url: z.string().url().max(FIELD_LENGTH_LIMITS.url),
  referring_domain: z.string().max(FIELD_LENGTH_LIMITS.domain),
  anchor_text: z.string().max(FIELD_LENGTH_LIMITS.anchorText),
  page_title: z.string().max(FIELD_LENGTH_LIMITS.title),
  raw_metrics: z.record(z.unknown()),
  raw_snapshot: z.string().max(SYNC_STRATEGY.maxSnapshotSize),
  site_summary: z.string().max(FIELD_LENGTH_LIMITS.siteSummary).optional(),
  link_type: z.nativeEnum(LinkType).optional(),
  site_business_types: z.array(z.nativeEnum(BusinessType)).optional(),
  context_match_score: z.number().min(0).max(100).optional(),
  context_match_note: z.string().max(FIELD_LENGTH_LIMITS.contextMatchNote).optional(),
  status: z.nativeEnum(BacklinkStatus),
  notes: z.string().max(FIELD_LENGTH_LIMITS.notes).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * 机会 Schema
 */
export const OpportunitySchema = z.object({
  id: z.string().uuid(),
  collected_backlink_id: z.string().uuid(),
  url: z.string().url().max(FIELD_LENGTH_LIMITS.url),
  domain: z.string().max(FIELD_LENGTH_LIMITS.domain),
  page_type: z.nativeEnum(PageType),
  path_pattern: z.string().max(FIELD_LENGTH_LIMITS.pathPattern),
  link_type: z.nativeEnum(LinkType),
  site_summary: z.string().max(FIELD_LENGTH_LIMITS.siteSummary),
  site_business_types: z.array(z.nativeEnum(BusinessType)),
  context_match_score: z.number().min(0).max(100),
  context_match_note: z.string().max(FIELD_LENGTH_LIMITS.contextMatchNote),
  can_submit: z.boolean(),
  can_auto_fill: z.boolean(),
  can_auto_submit: z.boolean(),
  status: z.nativeEnum(OpportunityStatus),
  notes: z.string().max(FIELD_LENGTH_LIMITS.notes).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * 字段映射 Schema
 */
export const FieldMappingSchema = z.object({
  field_type: z.enum(['name', 'email', 'website', 'comment', 'submit']),
  selector: z.string(),
  required: z.boolean(),
  default_value: z.string().optional(),
});

/**
 * 站点模板 Schema
 */
export const SiteTemplateSchema = z.object({
  id: z.string().uuid(),
  domain: z.string().max(FIELD_LENGTH_LIMITS.domain),
  page_type: z.nativeEnum(PageType),
  path_pattern: z.string().max(FIELD_LENGTH_LIMITS.pathPattern),
  field_mappings: z.array(FieldMappingSchema),
  submit_selector: z.string(),
  version: z.number().int().positive(),
  updated_at: z.string().datetime(),
});

/**
 * 提交记录 Schema
 */
export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  domain: z.string().max(FIELD_LENGTH_LIMITS.domain),
  page_url: z.string().url().max(FIELD_LENGTH_LIMITS.url),
  submit_mode: z.nativeEnum(SubmitMode),
  did_click_submit: z.boolean(),
  result: z.nativeEnum(SubmissionResult),
  comment_excerpt: z.string().max(FIELD_LENGTH_LIMITS.commentExcerpt),
  error_message: z.string().max(FIELD_LENGTH_LIMITS.errorMessage).optional(),
  created_at: z.string().datetime(),
});

/**
 * 同步任务 Schema
 */
export const SyncJobSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.nativeEnum(SyncEntityType),
  entity_id: z.string().uuid(),
  operation: z.nativeEnum(SyncOperation),
  status: z.nativeEnum(SyncJobStatus),
  retry_count: z.number().int().min(0).max(SYNC_STRATEGY.maxRetries),
  error_message: z.string().max(FIELD_LENGTH_LIMITS.errorMessage).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * 收集批次 Schema
 */
export const CollectionBatchSchema = z.object({
  id: z.string(),
  source_platform: z.nativeEnum(SourcePlatform),
  count: z.number().int().positive(),
  collected_at: z.string().datetime(),
  sync_status: z.enum(['pending', 'syncing', 'synced', 'failed']),
  synced_count: z.number().int().min(0),
});

/**
 * 页面上下文 Schema
 */
export const PageContextSchema = z.object({
  opportunity_id: z.string().uuid(),
  domain: z.string().max(FIELD_LENGTH_LIMITS.domain),
  link_type: z.nativeEnum(LinkType),
  auto_fill_enabled: z.boolean(),
  auto_submit_enabled: z.boolean(),
  tab_id: z.number().int().positive().optional(),
  created_at: z.string().datetime(),
});

export const ExtensionSettingsSchema = z.object({
  auto_detect_form: z.boolean(),
  auto_start_fill: z.boolean(),
  next_backlink_count: z.number().int().min(1),
  unique_backlink_domain: z.boolean(),
  show_manual_fill_hints: z.boolean(),
});

/**
 * 类型推导
 */
export type CollectedBacklinkInput = z.infer<typeof CollectedBacklinkSchema>;
export type OpportunityInput = z.infer<typeof OpportunitySchema>;
export type FieldMappingInput = z.infer<typeof FieldMappingSchema>;
export type SiteTemplateInput = z.infer<typeof SiteTemplateSchema>;
export type SubmissionInput = z.infer<typeof SubmissionSchema>;
export type SyncJobInput = z.infer<typeof SyncJobSchema>;
export type CollectionBatchInput = z.infer<typeof CollectionBatchSchema>;
export type PageContextInput = z.infer<typeof PageContextSchema>;
export type ExtensionSettingsInput = z.infer<typeof ExtensionSettingsSchema>;
