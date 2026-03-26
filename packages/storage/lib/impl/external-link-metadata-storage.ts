/**
 * ExternalLinkMetadata 层 Storage
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { ExternalLinkMetadata } from '@extension/shared';

interface ExternalLinkMetadataState {
  metadata: Record<string, ExternalLinkMetadata>;
  lastUpdated: string;
}

const storage = createStorage<ExternalLinkMetadataState>(
  'external-link-metadata-storage-key',
  { metadata: {}, lastUpdated: new Date().toISOString() },
  { storageEnum: StorageEnum.Local, liveUpdate: true },
);

export const externalLinkMetadataStorage = {
  ...storage,

  async get(linkId: string): Promise<ExternalLinkMetadata | null> {
    const state = await storage.get();
    return state.metadata[linkId] ?? null;
  },

  async set(metadata: ExternalLinkMetadata): Promise<void> {
    await storage.set(state => ({
      ...state,
      metadata: { ...state.metadata, [metadata.linkId]: metadata },
      lastUpdated: new Date().toISOString(),
    }));
  },

  async delete(linkId: string): Promise<void> {
    await storage.set(state => {
      const next = { ...state.metadata };
      delete next[linkId];
      return { ...state, metadata: next, lastUpdated: new Date().toISOString() };
    });
  },
};
