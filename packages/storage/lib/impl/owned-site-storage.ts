/**
 * OwnedSite 基础层 Storage
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { OwnedSite } from '@extension/shared';

interface OwnedSiteStorageState {
  sites: OwnedSite[];
  lastUpdated: string;
}

const storage = createStorage<OwnedSiteStorageState>(
  'owned-site-storage-key',
  {
    sites: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const ownedSiteStorage = {
  ...storage,

  async getAll(): Promise<OwnedSite[]> {
    const state = await storage.get();
    return state.sites;
  },

  async getById(id: string): Promise<OwnedSite | null> {
    const state = await storage.get();
    return state.sites.find(s => s.id === id) ?? null;
  },

  async add(site: OwnedSite): Promise<void> {
    await storage.set(state => ({
      ...state,
      sites: [...state.sites, site],
      lastUpdated: new Date().toISOString(),
    }));
  },

  async update(id: string, updates: Partial<OwnedSite>): Promise<void> {
    await storage.set(state => ({
      ...state,
      sites: state.sites.map(s => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s)),
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(id: string): Promise<void> {
    await storage.set(state => ({
      ...state,
      sites: state.sites.filter(s => s.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },
};
