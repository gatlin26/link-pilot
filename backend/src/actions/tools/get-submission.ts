'use server';

import { getDb } from '@/db';
import { tools } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * 获取单个提交的参数 Schema
 */
const getSubmissionSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
});

/**
 * 获取单个工具提交（仅提交者本人）
 */
export const getSubmissionAction = userActionClient
  .schema(getSubmissionSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const { toolId } = parsedInput;
      const { user } = ctx as { user: User };
      const db = await getDb();

      // 查询工具，确保属于当前用户
      const [tool] = await db
        .select({
          id: tools.id,
          name: tools.name,
          url: tools.url,
          slug: tools.slug,
          iconUrl: tools.iconUrl,
          thumbnailUrl: tools.thumbnailUrl,
          imageUrl: tools.imageUrl,
          status: tools.status,
          rejectReason: tools.rejectReason,
          published: tools.published,
          createdAt: tools.createdAt,
          updatedAt: tools.updatedAt,
        })
        .from(tools)
        .where(and(eq(tools.id, toolId), eq(tools.submitterUserId, user.id)))
        .limit(1);

      if (!tool) {
        throw new Error(
          'Tool not found or you do not have permission to view it'
        );
      }

      return {
        success: true,
        data: tool,
      } as const;
    } catch (error) {
      console.error('get submission error:', error);
      throw error;
    }
  });
