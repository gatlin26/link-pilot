import type { LinkAvailabilityStatus, LinkSiteType } from './enums.js';
import type { DynamicFieldDefinition, TemplateRecommendation } from './owned-site-types.js';

/**
 * 外链 — 基础实体层
 */
export interface ExternalLink {
  id: string;
  groupId: string;
  url: string;
  domain: string;
  status: LinkAvailabilityStatus;
  siteType: LinkSiteType;
  favorite: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
}

/**
 * 外链 — AI 元数据层
 */
export interface ExternalLinkMetadata {
  linkId: string;
  siteName?: string;
  pageTitle?: string;
  summary?: string;
  description?: string;
  language?: string;
  categories?: string[];
  dr?: number;
  as?: number;
  detectedSiteType?: LinkSiteType;
  typeConfidence?: number;
  availableSignals?: {
    httpStatus?: number;
    reachable?: boolean;
    hasForm?: boolean;
    lastError?: string;
  };
  formFields: DynamicFieldDefinition[];
  dataFields: DynamicFieldDefinition[];
  recommendedTemplates: TemplateRecommendation[];
  analysisSummary?: string;
  generatedAt: string;
}

/**
 * 外链 — 用户配置层
 */
export interface ExternalLinkProfile {
  linkId: string;
  approvedSiteType?: LinkSiteType;
  customTags: string[];
  visibleFieldKeys: string[];
  customFieldValues: Record<string, string>;
  preferredTemplateId?: string;
  notes?: string;
  updatedAt: string;
}
