/**
 * 提交记录存储实现
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { Submission } from '@extension/shared';

export interface SubmissionStorageState {
  submissions: Submission[];
  lastUpdated: string;
}

const storage = createStorage<SubmissionStorageState>(
  'submission-storage-key',
  {
    submissions: [],
    lastUpdated: new Date().toISOString(),
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const submissionStorage = {
  ...storage,

  /**
   * 获取所有提交记录
   */
  getAll: async (): Promise<Submission[]> => {
    const state = await storage.get();
    return state.submissions;
  },

  /**
   * 根据 ID 获取提交记录
   */
  getById: async (id: string): Promise<Submission | null> => {
    const state = await storage.get();
    return state.submissions.find(s => s.id === id) || null;
  },

  /**
   * 根据机会 ID 获取提交记录
   */
  getByOpportunityId: async (opportunityId: string): Promise<Submission[]> => {
    const state = await storage.get();
    return state.submissions.filter(s => s.opportunity_id === opportunityId);
  },

  /**
   * 根据域名获取提交记录
   */
  getByDomain: async (domain: string): Promise<Submission[]> => {
    const state = await storage.get();
    return state.submissions.filter(s => s.domain === domain);
  },

  /**
   * 添加提交记录
   */
  add: async (submission: Submission): Promise<void> => {
    await storage.set(state => ({
      submissions: [...state.submissions, submission],
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 更新提交记录
   */
  update: async (id: string, updates: Partial<Submission>): Promise<void> => {
    await storage.set(state => ({
      submissions: state.submissions.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 删除提交记录
   */
  delete: async (id: string): Promise<void> => {
    await storage.set(state => ({
      submissions: state.submissions.filter(s => s.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  },

  /**
   * 清空所有提交记录
   */
  clear: async (): Promise<void> => {
    await storage.set({
      submissions: [],
      lastUpdated: new Date().toISOString(),
    });
  },
};
