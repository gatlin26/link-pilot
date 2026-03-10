'use server';

import { getDb } from '@/db';
import { tools } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * 更新提交的参数 Schema
 */
const updateSubmissionSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  name: z
    .string()
    .min(2, 'Tool name must be at least 2 characters')
    .max(100, 'Tool name must not exceed 100 characters'),
  url: z.string().url('Please enter a valid URL'),
});

/**
 * 更新工具提交（仅提交者本人）
 * 更新后状态重置为 pending，清除拒绝原因
 */
export const updateSubmissionAction = userActionClient
  .schema(updateSubmissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const { toolId, name, url } = parsedInput;
      const { user } = ctx as { user: User };
      const db = await getDb();

      // 验证工具是否属于当前用户
      const tool = await db
        .select()
        .from(tools)
        .where(and(eq(tools.id, toolId), eq(tools.submitterUserId, user.id)))
        .limit(1);

      if (tool.length === 0) {
        throw new Error(
          'Tool not found or you do not have permission to update it'
        );
      }

      // 更新工具信息，重置状态为 pending，清除拒绝原因
      await db
        .update(tools)
        .set({
          name,
          url,
          status: 'pending',
          rejectReason: null,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      return {
        success: true,
        message: 'Submission updated successfully. It will be reviewed again.',
      } as const;
    } catch (error) {
      console.error('update submission error:', error);
      throw error;
    }
  });
