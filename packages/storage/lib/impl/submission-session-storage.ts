import { createStorage, StorageEnum } from '../base/index.js';
import type { SubmissionSession } from '@extension/shared';

const fallback: SubmissionSession = {
  queue_backlink_ids: [],
  queue_cursor: 0,
};

const storage = createStorage<SubmissionSession>('submission-session-storage-key', fallback, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const submissionSessionStorage = {
  ...storage,

  async getSession(): Promise<SubmissionSession> {
    return storage.get();
  },

  async updateSession(updates: Partial<SubmissionSession>): Promise<void> {
    await storage.set(current => ({
      ...current,
      ...updates,
    }));
  },

  async resetQueue(): Promise<void> {
    await storage.set(current => ({
      ...current,
      queue_backlink_ids: [],
      queue_cursor: 0,
    }));
  },
};
