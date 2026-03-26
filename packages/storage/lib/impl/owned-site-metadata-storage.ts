/**
 * OwnedSiteMetadata 层 Storage
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { OwnedSiteMetadata } from '@extension/shared';

interface OwnedSiteMetadataState {
  metadata: Record<string, OwnedSiteMetadata>;
  lastUpdated: string;
}

const storage = createStorage<OwnedSiteMetadataState>(
  'owned-site-metadata-storage-key',
  { metadata: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const ownedSiteMetadataStorage = {
  ...storage,

  async get(siteId: string): Promise<OwnedSiteMetadata | null> {
    const state = await storage.get();
    return state.metadata[siteId] ?? null;
  },

  async set(metadata: OwnedSiteMetadata): Promise<void> {
    await storage.set(state => ({
      ...state,
      metadata: { ...state.metadata, [metadata.siteId]: metadata },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(siteId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.metadata };
      delete next[siteId];
      return { ...state, metadata: next, lastUpdated: new Date().toISOString() };
    });
  },
};
