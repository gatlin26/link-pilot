import { useState, useCallback } from 'react';
import {
  backlinkStorage,
  collectionBatchStorage,
  syncQueueService,
  syncSettingsStorage,
  syncRunnerService,
} from '@extension/storage';
import { identificationService, sendMessageToTabSafely } from '@extension/shared';
import { SourcePlatform, SyncEntityType, SyncOperation } from '@extension/shared/lib/types/enums';
import type { CollectedBacklink, CollectionBatch } from '@extension/shared/lib/types/models';

export interface CollectionResult {
  success: boolean;
  count: number;
  batchId?: string;
  error?: string;
}

export function useCollection() {
  const [isCollecting, setIsCollecting] = useState(false);
  const [lastResult, setLastResult] = useState<CollectionResult | null>(null);

  const collect = useCallback(async (count: 10 | 20): Promise<CollectionResult> => {
    if (isCollecting) {
      return { success: false, count: 0, error: '正在收集中，请稍候' };
    }

    setIsCollecting(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        throw new Error('无法获取当前标签页');
      }

      const response = await sendMessageToTabSafely(tab.id, {
        type: 'COLLECT_BACKLINKS',
        payload: { count },
      });

      if (!response?.success) {
        throw new Error(response?.error || '收集失败');
      }

      const rawBacklinks = response.data as CollectedBacklink[];
      if (!rawBacklinks || rawBacklinks.length === 0) {
        throw new Error('未找到可收集的数据');
      }

      const baseBatchId = rawBacklinks[0]?.collection_batch_id || crypto.randomUUID();
      const identificationResults = await identificationService.identifyBatch(rawBacklinks);
      const identifiedBacklinks = rawBacklinks.map((backlink, index) => ({
        ...backlink,
        collection_batch_id: baseBatchId,
        ...identificationResults[index],
      }));

      const existingBacklinks = await backlinkStorage.getAll();
      const existingKeys = new Set(
        existingBacklinks.map(backlink => `${backlink.referring_page_url}|${backlink.target_url}`),
      );

      const backlinks = identifiedBacklinks.filter(backlink => {
        const key = `${backlink.referring_page_url}|${backlink.target_url}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });

      if (backlinks.length === 0) {
        throw new Error('本次采集的数据与本地记录重复，无新增数据');
      }

      const batch: CollectionBatch = {
        id: baseBatchId,
        source_platform: SourcePlatform.AHREFS,
        count: backlinks.length,
        collected_at: backlinks[0]?.collected_at || new Date().toISOString(),
        sync_status: 'pending',
        synced_count: 0,
      };

      await collectionBatchStorage.add(batch);
      await backlinkStorage.addBatch(backlinks);

      const syncJobs = backlinks.map(backlink => ({
        entityType: SyncEntityType.BACKLINK,
        entityId: backlink.id,
        operation: SyncOperation.CREATE,
      }));
      await syncQueueService.enqueueBatch(syncJobs);
      await collectionBatchStorage.updateSyncStatus(baseBatchId, 'pending', 0);

      const settings = await syncSettingsStorage.get();
      if (settings.webAppUrl) {
        await syncRunnerService.processPendingJobs().catch(error => {
          console.error('自动同步失败:', error);
        });
      }

      const result: CollectionResult = {
        success: true,
        count: backlinks.length,
        batchId: baseBatchId,
      };

      setLastResult(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const result: CollectionResult = {
        success: false,
        count: 0,
        error: errorMessage,
      };
      setLastResult(result);
      return result;
    } finally {
      setIsCollecting(false);
    }
  }, [isCollecting]);

  return {
    isCollecting,
    lastResult,
    collect,
  };
}
