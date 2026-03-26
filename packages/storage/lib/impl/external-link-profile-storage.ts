/**
 * ExternalLinkProfile 层 Storage
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { ExternalLinkProfile } from '@extension/shared';

interface ExternalLinkProfileState {
  profiles: Record<string, ExternalLinkProfile>;
  lastUpdated: string;
}

const storage = createStorage<ExternalLinkProfileState>(
  'external-link-profile-storage-key',
  { profiles: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const externalLinkProfileStorage = {
  ...storage,

  async get(linkId: string): Promise<ExternalLinkProfile | null> {
    const state = await storage.get();
    return state.profiles[linkId] ?? null;
  },

  async upsert(profile: ExternalLinkProfile): Promise<void> {
    await storage.set(state => ({
      ...state,
      profiles: { ...state.profiles, [profile.linkId]: profile },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(linkId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.profiles };
      delete next[linkId];
      return { ...state, profiles: next, lastUpdated: new Date().toISOString() };
    });
  },
};
