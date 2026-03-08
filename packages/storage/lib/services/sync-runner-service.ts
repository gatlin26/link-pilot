/**
 * 同步执行服务
 */

import { SyncService, BacklinkStatus, SyncEntityType } from '@extension/shared';
import type { SyncJob } from '@extension/shared';
import { backlinkStorage } from '../impl/backlink-storage.js';
import { collectionBatchStorage } from '../impl/collection-batch-storage.js';
import { opportunityStorage } from '../impl/opportunity-storage.js';
import { submissionStorage } from '../impl/submission-storage.js';
import { syncSettingsStorage } from '../impl/sync-settings-storage.js';
import { templateStorage } from '../impl/template-storage.js';
import { syncQueueStorage } from '../impl/sync-queue-storage.js';
import { syncQueueService } from './sync-queue-service.js';

export interface SyncRunnerResult {
  total: number;
  success: number;
  failed: number;
}

class SyncRunnerService {
  async testConnection(webAppUrl?: string): Promise<boolean> {
    const settings = await syncSettingsStorage.get();
    const finalUrl = (webAppUrl ?? settings.webAppUrl).trim();
    if (!finalUrl) {
      return false;
    }

    const syncService = new SyncService({ webAppUrl: finalUrl });
    return syncService.testConnection();
  }

  async processPendingJobs(): Promise<SyncRunnerResult> {
    const settings = await syncSettingsStorage.get();
    const webAppUrl = settings.webAppUrl.trim();
    if (!webAppUrl) {
      throw new Error('请先在设置中配置 Google Sheets Web App URL');
    }

    const jobs = await syncQueueStorage.getAll();
    const executableJobs = jobs.filter(job => job.status === 'pending' || job.status === 'failed');
    if (executableJobs.length === 0) {
      return { total: 0, success: 0, failed: 0 };
    }

    const syncService = new SyncService({ webAppUrl });
    const result = await syncService.syncJobs(executableJobs, {
      getBacklinkById: backlinkStorage.getById,
      getOpportunityById: opportunityStorage.getById,
      getTemplateById: templateStorage.getById,
      getSubmissionById: submissionStorage.getById,
    });

    const failedMap = new Map((result.errors || []).map(item => [item.jobId, item.error]));
    const successfulJobs = executableJobs.filter(job => !failedMap.has(job.id));
    const failedJobs = executableJobs.filter(job => failedMap.has(job.id));

    for (const job of successfulJobs) {
      await syncQueueService.markSuccess(job.id);
      await this.handleEntitySyncSuccess(job);
    }

    for (const job of failedJobs) {
      const errorMessage = failedMap.get(job.id) || '同步失败';
      await syncQueueService.markFailed(job.id, errorMessage);
      await this.handleEntitySyncFailure(job);
    }

    await this.refreshBatchStatuses(executableJobs);

    return {
      total: executableJobs.length,
      success: successfulJobs.length,
      failed: failedJobs.length,
    };
  }

  private async handleEntitySyncSuccess(job: SyncJob): Promise<void> {
    if (job.entity_type === SyncEntityType.BACKLINK) {
      await backlinkStorage.update(job.entity_id, { status: BacklinkStatus.SYNCED });
    }
  }

  private async handleEntitySyncFailure(job: SyncJob): Promise<void> {
    if (job.entity_type === SyncEntityType.BACKLINK) {
      await backlinkStorage.update(job.entity_id, { status: BacklinkStatus.SYNC_FAILED });
    }
  }

  private async refreshBatchStatuses(jobs: SyncJob[]): Promise<void> {
    const backlinkJobs = jobs.filter(job => job.entity_type === SyncEntityType.BACKLINK);
    if (backlinkJobs.length === 0) {
      return;
    }

    const batchIds = new Set<string>();
    for (const job of backlinkJobs) {
      const backlink = await backlinkStorage.getById(job.entity_id);
      if (backlink?.collection_batch_id) {
        batchIds.add(backlink.collection_batch_id);
      }
    }

    for (const batchId of batchIds) {
      const backlinks = await backlinkStorage.getByBatchId(batchId);
      const total = backlinks.length;
      const synced = backlinks.filter(backlink => backlink.status === BacklinkStatus.SYNCED).length;
      const failed = backlinks.filter(backlink => backlink.status === BacklinkStatus.SYNC_FAILED).length;

      let syncStatus: 'pending' | 'syncing' | 'synced' | 'failed' = 'pending';
      if (synced === total && total > 0) {
        syncStatus = 'synced';
      } else if (failed > 0) {
        syncStatus = 'failed';
      } else if (synced > 0) {
        syncStatus = 'syncing';
      }

      await collectionBatchStorage.updateSyncStatus(batchId, syncStatus, synced);
    }
  }
}

export const syncRunnerService = new SyncRunnerService();
