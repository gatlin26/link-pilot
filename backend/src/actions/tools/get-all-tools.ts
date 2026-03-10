'use server';

import { getDb } from '@/db';
import { toolTranslations, tools, user } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const getAllToolsSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional().default(''),
  published: z.enum(['all', 'true', 'false']).optional().default('all'),
  featured: z.enum(['all', 'true', 'false']).optional().default('all'),
  status: z
    .enum(['all', 'pending', 'rejected', 'published'])
    .optional()
    .default('all'),
});

/**
 * 获取所有工具列表（仅管理员）
 * 支持分页、搜索、筛选
 */
export const getAllToolsAction = adminActionClient
  .schema(getAllToolsSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { pageIndex, pageSize, search, published, featured, status } =
        parsedInput;
      const db = await getDb();

      const whereConditions = [];

      // 发布状态筛选
      if (published !== 'all') {
        whereConditions.push(eq(tools.published, published === 'true'));
      }

      // 精选状态筛选
      if (featured !== 'all') {
        whereConditions.push(eq(tools.featured, featured === 'true'));
      }

      // 审核状态筛选
      if (status !== 'all') {
        whereConditions.push(eq(tools.status, status));
      }

      // 搜索条件（名称、URL、slug）
      if (search) {
        const searchCondition = or(
          ilike(tools.name, `%${search}%`),
          ilike(tools.url, `%${search}%`),
          ilike(tools.slug, `%${search}%`)
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      const whereClause =
        whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const offset = pageIndex * pageSize;

      // 查询数据（包含英文翻译信息和提交者信息）
      const [items, [{ count }]] = await Promise.all([
        db
          .select({
            id: tools.id,
            slug: tools.slug,
            name: tools.name,
            url: tools.url,
            tags: tools.tags,
            dr: tools.dr,
            mv: tools.mv,
            iconUrl: tools.iconUrl,
            imageUrl: tools.imageUrl,
            thumbnailUrl: tools.thumbnailUrl,
            starRating: tools.starRating,
            featured: tools.featured,
            published: tools.published,
            status: tools.status,
            rejectReason: tools.rejectReason,
            submitterUserId: tools.submitterUserId,
            submitterEmail: tools.submitterEmail,
            submissionId: tools.submissionId,
            collectionTime: tools.collectionTime,
            createdAt: tools.createdAt,
            updatedAt: tools.updatedAt,
            enTitle: toolTranslations.title,
            enDescription: toolTranslations.description,
            // 提交者用户信息
            userName: user.name,
            userEmail: user.email,
          })
          .from(tools)
          .leftJoin(
            toolTranslations,
            and(
              eq(tools.id, toolTranslations.toolId),
              eq(toolTranslations.locale, 'en')
            )
          )
          .leftJoin(user, eq(tools.submitterUserId, user.id))
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
      console.error('get all tools error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tools',
      };
    }
  });
