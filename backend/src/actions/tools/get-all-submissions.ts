'use server';

import { getDb } from '@/db';
import { toolSubmissions, user } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

/**
 * 获取所有提交记录的参数 Schema
 */
const getAllSubmissionsSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional().default(''),
  status: z
    .enum(['pending', 'approved', 'rejected', 'all'])
    .optional()
    .default('all'),
});

/**
 * 获取所有用户的工具提交记录（仅管理员）
 */
export const getAllSubmissionsAction = adminActionClient
  .schema(getAllSubmissionsSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { pageIndex, pageSize, search, status } = parsedInput;
      const db = await getDb();

      // 构建查询条件
      const whereConditions = [];

      // 状态筛选
      if (status !== 'all') {
        whereConditions.push(eq(toolSubmissions.status, status));
      }

      // 搜索条件（工具名称、URL、邮箱）
      if (search) {
        const searchCondition = or(
          ilike(toolSubmissions.name, `%${search}%`),
          ilike(toolSubmissions.url, `%${search}%`),
          ilike(toolSubmissions.email, `%${search}%`)
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const offset = pageIndex * pageSize;

      // 查询数据（包含用户信息）
      const [items, [{ count }]] = await Promise.all([
        db
          .select({
            id: toolSubmissions.id,
            userId: toolSubmissions.userId,
            name: toolSubmissions.name,
            url: toolSubmissions.url,
            category: toolSubmissions.category,
            description: toolSubmissions.description,
            email: toolSubmissions.email,
            status: toolSubmissions.status,
            rejectReason: toolSubmissions.rejectReason,
            createdAt: toolSubmissions.createdAt,
            updatedAt: toolSubmissions.updatedAt,
            userName: user.name,
            userEmail: user.email,
          })
          .from(toolSubmissions)
          .leftJoin(user, eq(toolSubmissions.userId, user.id))
          .where(whereClause)
          .orderBy(desc(toolSubmissions.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(toolSubmissions)
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
      console.error('get all submissions error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch submissions',
      };
    }
  });
