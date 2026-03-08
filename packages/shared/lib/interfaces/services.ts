/**
 * 服务接口定义
 */

import {
  CollectedBacklink,
  Opportunity,
  SiteTemplate,
  Submission,
  SyncJob,
  PageContext,
} from '../types/models.js';
import { LinkType, BusinessType } from '../types/enums.js';

/**
 * 识别结果
 */
export interface IdentificationResult {
  link_type: LinkType;
  site_business_types: BusinessType[];
  context_match_score: number;
  context_match_note: string;
  site_summary: string;
}

/**
 * 识别服务接口
 */
export interface IdentificationService {
  /**
   * 识别外链
   */
  identify(backlink: CollectedBacklink): Promise<IdentificationResult>;

  /**
   * 批量识别
   */
  identifyBatch(backlinks: CollectedBacklink[]): Promise<IdentificationResult[]>;
}

/**
 * 评分服务接口
 */
export interface ScoringService {
  /**
   * 计算上下文匹配分数
   */
  calculateContextMatchScore(
    linkType: LinkType,
    businessTypes: BusinessType[],
    domainAuthority?: number,
    contentRelevance?: number,
  ): number;

  /**
   * 生成评分说明
   */
  generateScoreNote(
    linkType: LinkType,
    businessTypes: BusinessType[],
    score: number,
  ): string;
}

/**
 * 业务类型检测服务接口
 */
export interface BusinessTypeDetectorService {
  /**
   * 检测业务类型
   */
  detect(url: string, title: string, anchorText: string): BusinessType[];

  /**
   * 提取关键词
   */
  extractKeywords(text: string): string[];
}

/**
 * 机会转换服务接口
 */
export interface OpportunityConverterService {
  /**
   * 转换为机会
   */
  convert(backlink: CollectedBacklink): Promise<Opportunity>;

  /**
   * 批量转换
   */
  convertBatch(backlinks: CollectedBacklink[]): Promise<Opportunity[]>;

  /**
   * 检查是否符合转换规则
   */
  canConvert(backlink: CollectedBacklink): boolean;

  /**
   * 强制转换（人工）
   */
  forceConvert(backlink: CollectedBacklink, reason: string): Promise<Opportunity>;
}

/**
 * 同步服务接口
 */
export interface SyncService {
  /**
   * 同步单个实体
   */
  syncEntity(entityType: string, entityId: string, operation: string): Promise<void>;

  /**
   * 批量同步
   */
  syncBatch(jobs: SyncJob[]): Promise<void>;

  /**
   * 处理同步队列
   */
  processSyncQueue(): Promise<void>;

  /**
   * 重试失败任务
   */
  retryFailed(): Promise<void>;
}

/**
 * Google Sheets API 客户端接口
 */
export interface SheetsApiClient {
  /**
   * 初始化 Sheets
   */
  initializeSheets(): Promise<void>;

  /**
   * 批量写入外链
   */
  writeBacklinks(backlinks: CollectedBacklink[]): Promise<void>;

  /**
   * 批量写入机会
   */
  writeOpportunities(opportunities: Opportunity[]): Promise<void>;

  /**
   * 批量写入模板
   */
  writeTemplates(templates: SiteTemplate[]): Promise<void>;

  /**
   * 批量写入提交记录
   */
  writeSubmissions(submissions: Submission[]): Promise<void>;

  /**
   * 测试连接
   */
  testConnection(): Promise<boolean>;
}

/**
 * 上下文服务接口
 */
export interface ContextService {
  /**
   * 保存页面上下文
   */
  saveContext(context: PageContext): Promise<void>;

  /**
   * 获取页面上下文
   */
  getContext(url: string, tabId?: number): Promise<PageContext | null>;

  /**
   * 清理过期上下文
   */
  cleanupExpired(): Promise<void>;
}

/**
 * 批量处理服务接口
 */
export interface BatchProcessorService {
  /**
   * 批量打开页面
   */
  openPages(opportunities: Opportunity[]): Promise<void>;

  /**
   * 获取处理进度
   */
  getProgress(): {
    total: number;
    processed: number;
    failed: number;
  };

  /**
   * 暂停处理
   */
  pause(): void;

  /**
   * 恢复处理
   */
  resume(): void;

  /**
   * 停止处理
   */
  stop(): void;
}

/**
 * 表单识别结果
 */
export interface FormDetectionResult {
  detected: boolean;
  fields: {
    name?: HTMLElement;
    email?: HTMLElement;
    website?: HTMLElement;
    comment?: HTMLElement;
    submit?: HTMLElement;
  };
  confidence: number;
}

/**
 * 表单检测服务接口
 */
export interface FormDetectorService {
  /**
   * 检测表单
   */
  detect(document: Document): FormDetectionResult;

  /**
   * 使用模板检测
   */
  detectWithTemplate(document: Document, template: SiteTemplate): FormDetectionResult;
}

/**
 * 自动填充服务接口
 */
export interface AutoFillService {
  /**
   * 填充表单
   */
  fillForm(fields: FormDetectionResult['fields'], data: {
    name: string;
    email: string;
    website: string;
    comment: string;
  }): Promise<void>;

  /**
   * 验证填充结果
   */
  validateFill(fields: FormDetectionResult['fields']): boolean;
}

/**
 * 模板学习服务接口
 */
export interface TemplateLearnerService {
  /**
   * 从成功提交学习模板
   */
  learnFromSubmission(
    domain: string,
    pageUrl: string,
    fields: FormDetectionResult['fields'],
  ): Promise<SiteTemplate>;

  /**
   * 手动标注模板
   */
  manualAnnotate(
    domain: string,
    pageUrl: string,
    annotations: Record<string, string>,
  ): Promise<SiteTemplate>;

  /**
   * 更新模板
   */
  updateTemplate(templateId: string, updates: Partial<SiteTemplate>): Promise<SiteTemplate>;
}
