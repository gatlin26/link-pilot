/**
 * 机会仓储实现
 */

import type { OpportunityRepository } from '@extension/shared';
import type { Opportunity } from '@extension/shared';
import { OpportunityStatus } from '@extension/shared';
import { opportunityStorage } from '../impl/opportunity-storage.js';

export class OpportunityRepositoryImpl implements OpportunityRepository {
  async findById(id: string): Promise<Opportunity | null> {
    return opportunityStorage.getById(id);
  }

  async findAll(): Promise<Opportunity[]> {
    return opportunityStorage.getAll();
  }

  async create(entity: Opportunity): Promise<Opportunity> {
    await opportunityStorage.add(entity);
    return entity;
  }

  async update(id: string, entity: Partial<Opportunity>): Promise<Opportunity> {
    await opportunityStorage.update(id, entity);
    const updated = await opportunityStorage.getById(id);
    if (!updated) {
      throw new Error(`Opportunity with id ${id} not found after update`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await opportunityStorage.delete(id);
  }

  async findByStatus(status: OpportunityStatus): Promise<Opportunity[]> {
    return opportunityStorage.getByStatus(status);
  }

  async findByDomain(domain: string): Promise<Opportunity[]> {
    return opportunityStorage.getByDomain(domain);
  }

  async findByBacklinkId(backlinkId: string): Promise<Opportunity | null> {
    return opportunityStorage.getByBacklinkId(backlinkId);
  }

  async updateStatus(id: string, status: OpportunityStatus): Promise<void> {
    await opportunityStorage.update(id, { status });
  }

  async getStats(): Promise<{ total: number; byStatus: Record<OpportunityStatus, number> }> {
    const all = await opportunityStorage.getAll();
    const byStatus = {} as Record<OpportunityStatus, number>;

    Object.values(OpportunityStatus).forEach(status => {
      byStatus[status] = 0;
    });

    all.forEach(opportunity => {
      byStatus[opportunity.status]++;
    });

    return {
      total: all.length,
      byStatus,
    };
  }
}

export const opportunityRepository = new OpportunityRepositoryImpl();
