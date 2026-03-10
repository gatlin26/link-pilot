'use server';

import { getDb } from '@/db';
import { tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * 拒绝提交的参数 Schema
 */
const rejectSubmissionSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  reason: z
    .string()
    .min(1, 'Reject reason is required')
    .max(500, 'Reject reason must not exceed 500 characters'),
});

/**
 * 拒绝工具提交（仅管理员）
 */
export const rejectSubmissionAction = adminActionClient
  .schema(rejectSubmissionSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId, reason } = parsedInput;
      const db = await getDb();

      // 更新状态为已拒绝，保存拒绝原因
      await db
        .update(tools)
        .set({
          status: 'rejected',
          rejectReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      return {
        success: true,
        message: 'Submission rejected successfully',
      } as const;
    } catch (error) {
      console.error('reject submission error:', error);
      throw error;
    }
  });
