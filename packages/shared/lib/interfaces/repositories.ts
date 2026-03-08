/**
 * 仓储接口定义
 */

import {
  CollectedBacklink,
  Opportunity,
  SiteTemplate,
  Submission,
  SyncJob,
  CollectionBatch,
} from '../types/models.js';
import { BacklinkStatus, OpportunityStatus, SyncJobStatus } from '../types/enums.js';

/**
 * 基础仓储接口
 */
export interface BaseRepository<T> {
  /**
   * 根据 ID 查找
   */
  findById(id: string): Promise<T | null>;

  /**
   * 查找所有
   */
  findAll(): Promise<T[]>;

  /**
   * 创建
   */
  create(entity: T): Promise<T>;

  /**
   * 更新
   */
  update(id: string, entity: Partial<T>): Promise<T>;

  /**
   * 删除
   */
  delete(id: string): Promise<void>;
}

/**
 * 已收集外链仓储接口
 */
export interface BacklinkRepository extends BaseRepository<CollectedBacklink> {
  /**
   * 根据批次 ID 查找
   */
  findByBatchId(batchId: string): Promise<CollectedBacklink[]>;

  /**
   * 根据状态查找
   */
  findByStatus(status: BacklinkStatus): Promise<CollectedBacklink[]>;

  /**
   * 根据目标 URL 查找（去重）
   */
  findByTargetUrl(targetUrl: string): Promise<CollectedBacklink | null>;

  /**
   * 批量创建
   */
  createBatch(backlinks: CollectedBacklink[]): Promise<CollectedBacklink[]>;

  /**
   * 更新状态
   */
  updateStatus(id: string, status: BacklinkStatus): Promise<void>;

  /**
   * 获取统计信息
   */
  getStats(): Promise<{
    total: number;
    byStatus: Record<BacklinkStatus, number>;
  }>;
}

/**
 * 机会仓储接口
 */
export interface OpportunityRepository extends BaseRepository<Opportunity> {
  /**
   * 根据状态查找
   */
  findByStatus(status: OpportunityStatus): Promise<Opportunity[]>;

  /**
   * 根据域名查找
   */
  findByDomain(domain: string): Promise<Opportunity[]>;

  /**
   * 根据已收集外链 ID 查找
   */
  findByBacklinkId(backlinkId: string): Promise<Opportunity | null>;

  /**
   * 更新状态
   */
  updateStatus(id: string, status: OpportunityStatus): Promise<void>;

  /**
   * 获取统计信息
   */
  getStats(): Promise<{
    total: number;
    byStatus: Record<OpportunityStatus, number>;
  }>;
}

/**
 * 站点模板仓储接口
 */
export interface TemplateRepository extends BaseRepository<SiteTemplate> {
  /**
   * 根据域名和页面类型查找
   */
  findByDomainAndPageType(domain: string, pageType: string): Promise<SiteTemplate[]>;

  /**
   * 查找最新版本
   */
  findLatestVersion(domain: string, pageType: string, pathPattern: string): Promise<SiteTemplate | null>;

  /**
   * 更新版本
   */
  updateVersion(id: string, version: number): Promise<void>;
}

/**
 * 提交记录仓储接口
 */
export interface SubmissionRepository extends BaseRepository<Submission> {
  /**
   * 根据机会 ID 查找
   */
  findByOpportunityId(opportunityId: string): Promise<Submission[]>;

  /**
   * 根据域名查找
   */
  findByDomain(domain: string): Promise<Submission[]>;

  /**
   * 获取统计信息
   */
  getStats(): Promise<{
    total: number;
    success: number;
    failed: number;
    unknown: number;
  }>;
}

/**
 * 同步任务仓储接口
 */
export interface SyncJobRepository extends BaseRepository<SyncJob> {
  /**
   * 根据状态查找
   */
  findByStatus(status: SyncJobStatus): Promise<SyncJob[]>;

  /**
   * 根据实体类型和 ID 查找
   */
  findByEntity(entityType: string, entityId: string): Promise<SyncJob[]>;

  /**
   * 获取待处理任务
   */
  getPendingJobs(limit?: number): Promise<SyncJob[]>;

  /**
   * 增加重试次数
   */
  incrementRetryCount(id: string): Promise<void>;

  /**
   * 清理已完成任务
   */
  cleanupCompleted(olderThan: Date): Promise<number>;
}

/**
 * 收集批次仓储接口
 */
export interface CollectionBatchRepository extends BaseRepository<CollectionBatch> {
  /**
   * 获取最近的批次
   */
  getRecent(limit?: number): Promise<CollectionBatch[]>;

  /**
   * 更新同步状态
   */
  updateSyncStatus(id: string, status: string, syncedCount: number): Promise<void>;
}
