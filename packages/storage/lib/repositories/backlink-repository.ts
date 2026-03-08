/**
 * 已收集外链仓储实现
 */

import type { BacklinkRepository } from '@extension/shared';
import type { CollectedBacklink } from '@extension/shared';
import { BacklinkStatus } from '@extension/shared';
import { backlinkStorage } from '../impl/backlink-storage.js';

export class BacklinkRepositoryImpl implements BacklinkRepository {
  async findById(id: string): Promise<CollectedBacklink | null> {
    return backlinkStorage.getById(id);
  }

  async findAll(): Promise<CollectedBacklink[]> {
    return backlinkStorage.getAll();
  }

  async create(entity: CollectedBacklink): Promise<CollectedBacklink> {
    await backlinkStorage.add(entity);
    return entity;
  }

  async update(id: string, entity: Partial<CollectedBacklink>): Promise<CollectedBacklink> {
    await backlinkStorage.update(id, entity);
    const updated = await backlinkStorage.getById(id);
    if (!updated) {
      throw new Error(`Backlink with id ${id} not found after update`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await backlinkStorage.delete(id);
  }

  async findByBatchId(batchId: string): Promise<CollectedBacklink[]> {
    return backlinkStorage.getByBatchId(batchId);
  }

  async findByStatus(status: BacklinkStatus): Promise<CollectedBacklink[]> {
    return backlinkStorage.getByStatus(status);
  }

  async findByTargetUrl(targetUrl: string): Promise<CollectedBacklink | null> {
    return backlinkStorage.getByTargetUrl(targetUrl);
  }

  async createBatch(backlinks: CollectedBacklink[]): Promise<CollectedBacklink[]> {
    await backlinkStorage.addBatch(backlinks);
    return backlinks;
  }

  async updateStatus(id: string, status: BacklinkStatus): Promise<void> {
    await backlinkStorage.update(id, { status });
  }

  async getStats(): Promise<{ total: number; byStatus: Record<BacklinkStatus, number> }> {
    const all = await backlinkStorage.getAll();
    const byStatus = {} as Record<BacklinkStatus, number>;

    Object.values(BacklinkStatus).forEach(status => {
      byStatus[status] = 0;
    });

    all.forEach(backlink => {
      byStatus[backlink.status]++;
    });

    return {
      total: all.length,
      byStatus,
    };
  }
}

export const backlinkRepository = new BacklinkRepositoryImpl();
