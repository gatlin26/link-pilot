/**
 * 同步服务
 * 负责将本地数据同步到 Google Sheets
 */

import type {
  CollectedBacklink,
  Opportunity,
  SiteTemplate,
  Submission,
  SyncJob,
} from '../types/models.js';
import { SyncEntityType } from '../types/enums.js';
import { SheetsApiClient } from './sheets-api-client.js';
import { SYNC_STRATEGY } from '../rules/business-rules.js';

/**
 * 同步服务配置
 */
export interface SyncServiceConfig {
  webAppUrl: string;
  batchSize?: number;
}

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean;
  total: number;
  synced: number;
  failed: number;
  errors?: Array<{ jobId: string; error: string }>;
}

/**
 * 数据获取器接口
 */
export interface DataFetcher {
  getBacklinkById(id: string): Promise<CollectedBacklink | null>;
  getOpportunityById(id: string): Promise<Opportunity | null>;
  getTemplateById(id: string): Promise<SiteTemplate | null>;
  getSubmissionById(id: string): Promise<Submission | null>;
}

/**
 * 同步服务
 */
export class SyncService {
  private client: SheetsApiClient;
  private batchSize: number;

  constructor(config: SyncServiceConfig) {
    this.client = new SheetsApiClient({
      webAppUrl: config.webAppUrl,
    });
    this.batchSize = config.batchSize || SYNC_STRATEGY.batchSize;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  /**
   * 同步任务
   */
  async syncJobs(
    jobs: SyncJob[],
    dataFetcher: DataFetcher,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      total: jobs.length,
      synced: 0,
      failed: 0,
      errors: [],
    };

    // 按实体类型分组
    const jobsByType = this.groupJobsByType(jobs);

    // 依次处理每种类型
    for (const [entityType, typeJobs] of Object.entries(jobsByType)) {
      const typeResult = await this.syncJobsByType(
        entityType as SyncEntityType,
        typeJobs,
        dataFetcher,
      );

      result.synced += typeResult.synced;
      result.failed += typeResult.failed;
      if (typeResult.errors) {
        result.errors?.push(...typeResult.errors);
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * 按类型分组任务
   */
  private groupJobsByType(jobs: SyncJob[]): Record<string, SyncJob[]> {
    return jobs.reduce(
      (acc, job) => {
        if (!acc[job.entity_type]) {
          acc[job.entity_type] = [];
        }
        acc[job.entity_type].push(job);
        return acc;
      },
      {} as Record<string, SyncJob[]>,
    );
  }

  /**
   * 按类型同步任务
   */
  private async syncJobsByType(
    entityType: SyncEntityType,
    jobs: SyncJob[],
    dataFetcher: DataFetcher,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      total: jobs.length,
      synced: 0,
      failed: 0,
      errors: [],
    };

    // 分批处理
    for (let i = 0; i < jobs.length; i += this.batchSize) {
      const batch = jobs.slice(i, i + this.batchSize);
      const batchResult = await this.syncBatch(entityType, batch, dataFetcher);

      result.synced += batchResult.synced;
      result.failed += batchResult.failed;
      if (batchResult.errors) {
        result.errors?.push(...batchResult.errors);
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * 同步一批任务
   */
  private async syncBatch(
    entityType: SyncEntityType,
    jobs: SyncJob[],
    dataFetcher: DataFetcher,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      total: jobs.length,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // 获取实体数据
      const entities = await this.fetchEntities(entityType, jobs, dataFetcher);

      // 过滤掉获取失败的实体
      const validEntities = entities.filter(e => e !== null);
      if (validEntities.length === 0) {
        result.failed = jobs.length;
        result.errors = jobs.map(job => ({
          jobId: job.id,
          error: '无法获取实体数据',
        }));
        return result;
      }

      // 调用 API 同步
      const apiResult = await this.callSyncApi(entityType, validEntities);

      if (apiResult.success && apiResult.data) {
        result.synced = apiResult.data.success;
        result.failed = apiResult.data.failed;

        // 映射错误到具体的 job
        if (apiResult.data.errors && apiResult.data.errors.length > 0) {
          result.errors = apiResult.data.errors.map(err => ({
            jobId: jobs[err.index]?.id || 'unknown',
            error: err.error,
          }));
        }
      } else {
        result.failed = jobs.length;
        result.errors = jobs.map(job => ({
          jobId: job.id,
          error: apiResult.error || '同步失败',
        }));
      }
    } catch (error) {
      result.failed = jobs.length;
      result.errors = jobs.map(job => ({
        jobId: job.id,
        error: error instanceof Error ? error.message : '未知错误',
      }));
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * 获取实体数据
   */
  private async fetchEntities(
    entityType: SyncEntityType,
    jobs: SyncJob[],
    dataFetcher: DataFetcher,
  ): Promise<Array<CollectedBacklink | Opportunity | SiteTemplate | Submission | null>> {
    const promises = jobs.map(job => {
      switch (entityType) {
        case SyncEntityType.BACKLINK:
          return dataFetcher.getBacklinkById(job.entity_id);
        case SyncEntityType.OPPORTUNITY:
          return dataFetcher.getOpportunityById(job.entity_id);
        case SyncEntityType.TEMPLATE:
          return dataFetcher.getTemplateById(job.entity_id);
        case SyncEntityType.SUBMISSION:
          return dataFetcher.getSubmissionById(job.entity_id);
        default:
          return Promise.resolve(null);
      }
    });

    return Promise.all(promises);
  }

  /**
   * 调用同步 API
   */
  private async callSyncApi(
    entityType: SyncEntityType,
    entities: Array<CollectedBacklink | Opportunity | SiteTemplate | Submission>,
  ) {
    switch (entityType) {
      case SyncEntityType.BACKLINK:
        return this.client.syncBacklinks(entities as CollectedBacklink[]);
      case SyncEntityType.OPPORTUNITY:
        return this.client.syncOpportunities(entities as Opportunity[]);
      case SyncEntityType.TEMPLATE:
        return this.client.syncTemplates(entities as SiteTemplate[]);
      case SyncEntityType.SUBMISSION:
        return this.client.syncSubmissions(entities as Submission[]);
      default:
        throw new Error(`不支持的实体类型: ${entityType}`);
    }
  }
}
