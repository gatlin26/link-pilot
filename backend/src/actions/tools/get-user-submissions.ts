'use server';

import { getDb } from '@/db';
import { tools } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

/**
 * 获取用户提交记录的参数 Schema
 */
const getUserSubmissionsSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(10),
  status: z
    .enum(['unpaid', 'pending', 'published', 'rejected', 'all'])
    .optional()
    .default('all'),
});

/**
 * 获取当前用户的工具提交记录
 * 查询 tools 表中 submitterUserId 为当前用户的记录
 */
export const getUserSubmissionsAction = userActionClient
  .schema(getUserSubmissionsSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const { pageIndex, pageSize, status } = parsedInput;
      const { user } = ctx as { user: User };
      const db = await getDb();

      // 构建查询条件
      const whereConditions = [eq(tools.submitterUserId, user.id)];
      if (status !== 'all') {
        whereConditions.push(eq(tools.status, status));
      }

      const whereClause =
        whereConditions.length > 1
          ? and(...whereConditions)
          : whereConditions[0];

      const offset = pageIndex * pageSize;

      // 查询数据
      const [items, [{ count }]] = await Promise.all([
        db
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
          .where(whereClause)
          .orderBy(desc(tools.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(tools)
          .where(whereClause),
      ]);

      return {
        success: true,
        data: {
          items,
          total: Number(count),
        },
      };
    } catch (error) {
      console.error('get user submissions error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch submissions',
      };
    }
  });
