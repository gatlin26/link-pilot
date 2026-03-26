/**
 * OwnedSiteProfile 层 Storage
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { OwnedSiteProfile } from '@extension/shared';

interface OwnedSiteProfileState {
  profiles: Record<string, OwnedSiteProfile>;
  lastUpdated: string;
}

const storage = createStorage<OwnedSiteProfileState>(
  'owned-site-profile-storage-key',
  { profiles: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const ownedSiteProfileStorage = {
  ...storage,

  async get(siteId: string): Promise<OwnedSiteProfile | null> {
    const state = await storage.get();
    return state.profiles[siteId] ?? null;
  },

  async upsert(profile: OwnedSiteProfile): Promise<void> {
    await storage.set(state => ({
      ...state,
      profiles: { ...state.profiles, [profile.siteId]: profile },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(siteId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.profiles };
      delete next[siteId];
      return { ...state, profiles: next, lastUpdated: new Date().toISOString() };
    });
  },
};
