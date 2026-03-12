/**
 * 状态机定义
 */

import { BacklinkStatus, OpportunityStatus, SubmissionResult, SyncJobStatus } from './enums.js';

/**
 * 已收集外链状态流转
 */
export const BacklinkStateTransitions: Record<BacklinkStatus, BacklinkStatus[]> = {
  [BacklinkStatus.COLLECTED]: [BacklinkStatus.SYNCED, BacklinkStatus.SYNC_FAILED],
  [BacklinkStatus.SYNCED]: [BacklinkStatus.REVIEWED, BacklinkStatus.CONVERTED, BacklinkStatus.ARCHIVED],
  [BacklinkStatus.SYNC_FAILED]: [BacklinkStatus.SYNCED, BacklinkStatus.ARCHIVED],
  [BacklinkStatus.REVIEWED]: [BacklinkStatus.CONVERTED, BacklinkStatus.ARCHIVED],
  [BacklinkStatus.CONVERTED]: [BacklinkStatus.ARCHIVED],
  [BacklinkStatus.ARCHIVED]: [],
};

/**
 * 机会状态流转
 */
export const OpportunityStateTransitions: Record<OpportunityStatus, OpportunityStatus[]> = {
  [OpportunityStatus.NEW]: [OpportunityStatus.READY_TO_SUBMIT, OpportunityStatus.REJECTED, OpportunityStatus.ARCHIVED, OpportunityStatus.CONVERTED, OpportunityStatus.DISCARDED],
  [OpportunityStatus.READY_TO_SUBMIT]: [
    OpportunityStatus.SUBMITTED,
    OpportunityStatus.REJECTED,
    OpportunityStatus.ARCHIVED,
  ],
  [OpportunityStatus.SUBMITTED]: [OpportunityStatus.ARCHIVED],
  [OpportunityStatus.REJECTED]: [OpportunityStatus.ARCHIVED],
  [OpportunityStatus.CONVERTED]: [OpportunityStatus.ARCHIVED],
  [OpportunityStatus.DISCARDED]: [OpportunityStatus.ARCHIVED],
  [OpportunityStatus.ARCHIVED]: [],
};

/**
 * 同步任务状态流转
 */
export const SyncJobStateTransitions: Record<SyncJobStatus, SyncJobStatus[]> = {
  [SyncJobStatus.PENDING]: [SyncJobStatus.SUCCESS, SyncJobStatus.FAILED],
  [SyncJobStatus.SUCCESS]: [],
  [SyncJobStatus.FAILED]: [SyncJobStatus.PENDING, SyncJobStatus.SUCCESS],
};

/**
 * 验证状态流转是否合法
 */
export function isValidBacklinkTransition(from: BacklinkStatus, to: BacklinkStatus): boolean {
  return BacklinkStateTransitions[from]?.includes(to) ?? false;
}

export function isValidOpportunityTransition(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return OpportunityStateTransitions[from]?.includes(to) ?? false;
}

export function isValidSyncJobTransition(from: SyncJobStatus, to: SyncJobStatus): boolean {
  return SyncJobStateTransitions[from]?.includes(to) ?? false;
}

/**
 * 状态机文档
 */
export const STATE_MACHINE_DOCS = {
  backlink: `
CollectedBacklink 状态流转:
collected → synced → reviewed → converted/archived
         ↘ sync_failed → synced (重试)
`,
  opportunity: `
Opportunity 状态流转:
new → ready_to_submit → submitted → archived
                     ↘ rejected
`,
  syncJob: `
SyncJob 状态流转:
pending → success/failed
       ↘ failed → pending (重试)
`,
  submission: `
Submission 结果:
- success: 提交成功
- failed: 提交失败
- unknown: 结果未知（需人工确认）
`,
} as const;
