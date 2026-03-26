/**
 * 我的网站 — 基础实体层
 */
export interface OwnedSite {
  id: string;
  groupId: string;
  url: string;
  domain: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 我的网站 — AI 元数据层
 */
export interface OwnedSiteMetadata {
  siteId: string;
  siteName?: string;
  siteTitle?: string;
  shortDescription?: string;
  fullDescription?: string;
  logoUrl?: string;
  screenshotUrl?: string;
  faviconUrl?: string;
  language?: string;
  categories?: string[];
  keywords?: string[];
  extractedFields: DynamicFieldDefinition[];
  analysisSummary?: string;
  generatedAt: string;
}

/**
 * 我的网站 — 用户配置层
 */
export interface OwnedSiteProfile {
  siteId: string;
  displayName?: string;
  customDescription?: string;
  approvedFields: DynamicFieldValue[];
  hiddenFieldKeys: string[];
  preferredTemplateIds: string[];
  notes?: string;
  updatedAt: string;
}

/**
 * 动态字段定义
 */
export interface DynamicFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'email' | 'image' | 'tag-list' | 'rich-text';
  source: 'system' | 'ai' | 'user';
  required: boolean;
  visible: boolean;
  group: 'site_info' | 'submission' | 'comment' | 'seo' | 'custom';
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  order: number;
}

/**
 * 动态字段值
 */
export interface DynamicFieldValue {
  key: string;
  value: string;
  updatedBy: 'ai' | 'user';
  updatedAt: string;
}

/**
 * 评论模板
 */
export interface CommentTemplate {
  id: string;
  name: string;
  siteType: string;
  tone?: string;
  prompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 模板推荐结果
 */
export interface TemplateRecommendation {
  templateId: string;
  score: number;
  reason: string;
}
