/**
 * 同步队列服务实现
 */

import type { SyncJob } from '@extension/shared';
import { SyncJobStatus, SyncEntityType, SyncOperation } from '@extension/shared';
import { syncQueueStorage } from '../impl/sync-queue-storage.js';
import { SYNC_STRATEGY } from '@extension/shared';

export class SyncQueueService {
  /**
   * 入队同步任务
   */
  async enqueue(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
  ): Promise<SyncJob> {
    const job: SyncJob = {
      id: crypto.randomUUID(),
      entity_type: entityType,
      entity_id: entityId,
      operation,
      status: SyncJobStatus.PENDING,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await syncQueueStorage.enqueue(job);
    return job;
  }

  /**
   * 批量入队
   */
  async enqueueBatch(jobs: Array<{
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
  }>): Promise<SyncJob[]> {
    const syncJobs: SyncJob[] = jobs.map(job => ({
      id: crypto.randomUUID(),
      entity_type: job.entityType,
      entity_id: job.entityId,
      operation: job.operation,
      status: SyncJobStatus.PENDING,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await syncQueueStorage.enqueueBatch(syncJobs);
    return syncJobs;
  }

  /**
   * 获取待处理任务
   */
  async getPendingJobs(limit?: number): Promise<SyncJob[]> {
    return syncQueueStorage.getPending(limit);
  }

  /**
   * 获取所有任务
   */
  async getAllJobs(): Promise<SyncJob[]> {
    return syncQueueStorage.getAll();
  }

  /**
   * 标记任务成功
   */
  async markSuccess(jobId: string): Promise<void> {
    await syncQueueStorage.update(jobId, {
      status: SyncJobStatus.SUCCESS,
    });
  }

  /**
   * 标记任务失败
   */
  async markFailed(jobId: string, errorMessage: string): Promise<void> {
    const job = await syncQueueStorage.getById(jobId);
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    if (job.retry_count < SYNC_STRATEGY.maxRetries) {
      await syncQueueStorage.incrementRetryCount(jobId);
      await syncQueueStorage.update(jobId, {
        status: SyncJobStatus.PENDING,
        error_message: errorMessage,
      });
    } else {
      await syncQueueStorage.update(jobId, {
        status: SyncJobStatus.FAILED,
        error_message: errorMessage,
      });
    }
  }

  /**
   * 获取失败任务
   */
  async getFailedJobs(): Promise<SyncJob[]> {
    return syncQueueStorage.getByStatus(SyncJobStatus.FAILED);
  }

  /**
   * 重试失败任务
   */
  async retryFailed(): Promise<void> {
    const failed = await this.getFailedJobs();
    for (const job of failed) {
      await syncQueueStorage.update(job.id, {
        status: SyncJobStatus.PENDING,
        retry_count: 0,
      });
    }
  }

  /**
   * 清理已完成任务
   */
  async cleanupCompleted(olderThanDays: number = 7): Promise<number> {
    const olderThan = new Date();
    olderThan.setDate(olderThan.getDate() - olderThanDays);
    return syncQueueStorage.cleanupCompleted(olderThan);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    success: number;
    failed: number;
  }> {
    const all = await syncQueueStorage.getAll();
    return {
      total: all.length,
      pending: all.filter(j => j.status === SyncJobStatus.PENDING).length,
      success: all.filter(j => j.status === SyncJobStatus.SUCCESS).length,
      failed: all.filter(j => j.status === SyncJobStatus.FAILED).length,
    };
  }
}

export const syncQueueService = new SyncQueueService();
