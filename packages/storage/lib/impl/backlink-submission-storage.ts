/**
 * 外链提交记录存储
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BacklinkSubmission, WebsiteBacklinkStats } from '@extension/shared';

const storage = createStorage<BacklinkSubmission[]>(
  'backlink-submissions-key',
  [],
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

/**
 * 添加提交记录
 */
async function addSubmission(submission: BacklinkSubmission): Promise<void> {
  const submissions = await storage.get();
  submissions.push(submission);
  await storage.set(submissions);
}

/**
 * 获取所有提交记录
 */
async function getAllSubmissions(): Promise<BacklinkSubmission[]> {
  return await storage.get();
}

/**
 * 获取某个网站的所有提交记录
 */
async function getByWebsite(websiteId: string): Promise<BacklinkSubmission[]> {
  const all = await storage.get();
  return all.filter((s: BacklinkSubmission) => s.website_profile_id === websiteId);
}

/**
 * 获取某个外链的所有提交记录
 */
async function getByBacklink(backlinkId: string): Promise<BacklinkSubmission[]> {
  const all = await storage.get();
  return all.filter((s: BacklinkSubmission) => s.managed_backlink_id === backlinkId);
}

/**
 * 更新提交状态
 */
async function updateStatus(
  id: string,
  status: 'submitted' | 'approved' | 'rejected'
): Promise<void> {
  const submissions = await storage.get();
  const submission = submissions.find((s: BacklinkSubmission) => s.id === id);

  if (submission) {
    submission.status = status;
    if (status === 'approved' && !submission.approved_at) {
      submission.approved_at = new Date().toISOString();
    }
    submission.updated_at = new Date().toISOString();
    await storage.set(submissions);
  }
}

/**
 * 删除提交记录
 */
async function deleteSubmission(id: string): Promise<void> {
  const submissions = await storage.get();
  const filtered = submissions.filter((s: BacklinkSubmission) => s.id !== id);
  await storage.set(filtered);
}

/**
 * 计算网站的外链统计
 */
async function getWebsiteStats(websiteId: string): Promise<WebsiteBacklinkStats> {
  const submissions = await getByWebsite(websiteId);

  // 统计这个网站提交过的不同外链数量（去重）
  const uniqueBacklinkIds = new Set(
    submissions.map((s: BacklinkSubmission) => s.managed_backlink_id)
  );

  return {
    total_backlinks: uniqueBacklinkIds.size,
    submitted_count: submissions.filter((s: BacklinkSubmission) =>
      s.status === 'submitted' || s.status === 'approved'
    ).length,
    approved_count: submissions.filter((s: BacklinkSubmission) =>
      s.status === 'approved'
    ).length,
  };
}

/**
 * 检查是否已提交过某个外链
 */
async function hasSubmitted(websiteId: string, backlinkId: string): Promise<boolean> {
  const submissions = await storage.get();
  return submissions.some((s: BacklinkSubmission) =>
    s.website_profile_id === websiteId &&
    s.managed_backlink_id === backlinkId &&
    (s.status === 'submitted' || s.status === 'approved')
  );
}

export const backlinkSubmissionStorage = {
  addSubmission,
  getAllSubmissions,
  getByWebsite,
  getByBacklink,
  updateStatus,
  deleteSubmission,
  getWebsiteStats,
  hasSubmitted,
};
