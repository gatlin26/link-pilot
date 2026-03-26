/**
 * ExternalLink 基础层 Storage
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { ExternalLink, LinkAvailabilityStatus } from '@extension/shared';

interface ExternalLinkState {
  links: ExternalLink[];
  lastUpdated: string;
}

const storage = createStorage<ExternalLinkState>(
  'external-link-storage-key',
  {
    links: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const externalLinkStorage = {
  ...storage,

  async getAll(): Promise<ExternalLink[]> {
    const state = await storage.get();
    return state.links;
  },

  async getById(id: string): Promise<ExternalLink | null> {
    const state = await storage.get();
    return state.links.find(l => l.id === id) ?? null;
  },

  async getByGroup(groupId: string): Promise<ExternalLink[]> {
    const state = await storage.get();
    return state.links.filter(l => l.groupId === groupId);
  },

  async add(link: ExternalLink): Promise<void> {
    await storage.set(state => ({
      ...state,
      links: [...state.links, link],
      lastUpdated: new Date().toISOString(),
    }));
  },

  async update(id: string, updates: Partial<ExternalLink>): Promise<void> {
    await storage.set(state => ({
      ...state,
      links: state.links.map(l => (l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l)),
      lastUpdated: new Date().toISOString(),
    }));
  },

  async updateStatus(id: string, status: LinkAvailabilityStatus, lastCheckedAt?: string): Promise<void> {
    await this.update(id, { status, lastCheckedAt });
  },

  async delete(id: string): Promise<void> {
    await storage.set(state => ({
      ...state,
      links: state.links.filter(l => l.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  async toggleFavorite(id: string): Promise<void> {
    const link = await this.getById(id);
    if (link) {
      await this.update(id, { favorite: !link.favorite });
    }
  },
};
