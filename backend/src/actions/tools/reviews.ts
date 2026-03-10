'use server';

import { getDb } from '@/db';
import { toolReviews, tools, user } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { actionClient, userActionClient } from '@/lib/safe-action';
import {
  and,
  avg,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  or,
} from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helper: 重新计算工具的平均评分和评论数
// ---------------------------------------------------------------------------
async function updateToolRatingStats(toolId: string) {
  const db = await getDb();

  const [stats] = await db
    .select({
      avgRating: avg(toolReviews.rating),
      reviewCount: count(),
    })
    .from(toolReviews)
    .where(
      and(
        eq(toolReviews.toolId, toolId),
        eq(toolReviews.status, 'published'),
        isNull(toolReviews.deletedAt)
      )
    );

  await db
    .update(tools)
    .set({
      avgRating: stats.avgRating ? Number(stats.avgRating).toFixed(1) : null,
      reviewCount: Number(stats.reviewCount),
      updatedAt: new Date(),
    })
    .where(eq(tools.id, toolId));
}

// ---------------------------------------------------------------------------
// 1. 提交 / 更新评论
// ---------------------------------------------------------------------------
const submitReviewSchema = z.object({
  toolId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(10000).optional(),
});

export const submitReviewAction = userActionClient
  .schema(submitReviewSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { user: currentUser } = ctx as { user: User };
    const { toolId, rating, comment } = parsedInput;
    const db = await getDb();

    // 允许同一用户对同一工具重复提交评论，每次提交都插入新记录
    await db.insert(toolReviews).values({
      id: nanoid(),
      toolId,
      userId: currentUser.id,
      rating,
      comment: comment || null,
    });

    await updateToolRatingStats(toolId);

    // 从 toolId 查 slug 来 revalidate 所有 locale 页面
    const [tool] = await db
      .select({ slug: tools.slug })
      .from(tools)
      .where(eq(tools.id, toolId))
      .limit(1);

    if (tool) {
      revalidatePath(`/tools/${tool.slug}`);
    }

    return { success: true } as const;
  });

// ---------------------------------------------------------------------------
// 2. 获取工具评论列表（公开）
// ---------------------------------------------------------------------------
const getToolReviewsSchema = z.object({
  toolId: z.string().min(1),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const getToolReviewsAction = actionClient
  .schema(getToolReviewsSchema)
  .action(async ({ parsedInput }) => {
    const { toolId, page, pageSize } = parsedInput;
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    const whereClause = and(
      eq(toolReviews.toolId, toolId),
      eq(toolReviews.status, 'published'),
      isNull(toolReviews.deletedAt)
    );

    const [reviews, [{ total }]] = await Promise.all([
      db
        .select({
          id: toolReviews.id,
          rating: toolReviews.rating,
          comment: toolReviews.comment,
          createdAt: toolReviews.createdAt,
          updatedAt: toolReviews.updatedAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(toolReviews)
        .innerJoin(user, eq(toolReviews.userId, user.id))
        .where(whereClause)
        .orderBy(desc(toolReviews.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(toolReviews).where(whereClause),
    ]);

    return {
      success: true,
      data: {
        reviews,
        total: Number(total),
        page,
        pageSize,
        hasMore: offset + pageSize < Number(total),
      },
    } as const;
  });

// ---------------------------------------------------------------------------
// 3. 获取当前用户对某工具的评论
// ---------------------------------------------------------------------------
const getUserReviewSchema = z.object({
  toolId: z.string().min(1),
});

export const getUserReviewAction = userActionClient
  .schema(getUserReviewSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { user: currentUser } = ctx as { user: User };
    const { toolId } = parsedInput;
    const db = await getDb();

    const result = await db
      .select({
        id: toolReviews.id,
        rating: toolReviews.rating,
        comment: toolReviews.comment,
        createdAt: toolReviews.createdAt,
      })
      .from(toolReviews)
      .where(
        and(
          eq(toolReviews.toolId, toolId),
          eq(toolReviews.userId, currentUser.id)
        )
      )
      .limit(1);

    return {
      success: true,
      data: result.length > 0 ? result[0] : null,
    } as const;
  });

// ---------------------------------------------------------------------------
// 4. 删除评论
// ---------------------------------------------------------------------------
const deleteReviewSchema = z.object({
  reviewId: z.string().min(1),
});

export const deleteReviewAction = userActionClient
  .schema(deleteReviewSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { user: currentUser } = ctx as { user: User };
    const { reviewId } = parsedInput;
    const db = await getDb();

    const [review] = await db
      .select({ toolId: toolReviews.toolId, userId: toolReviews.userId })
      .from(toolReviews)
      .where(eq(toolReviews.id, reviewId))
      .limit(1);

    if (!review) {
      return { success: false, error: 'Review not found' } as const;
    }

    if (
      review.userId !== currentUser.id &&
      (currentUser as User & { role?: string }).role !== 'admin'
    ) {
      return { success: false, error: 'Unauthorized' } as const;
    }

    await db.delete(toolReviews).where(eq(toolReviews.id, reviewId));
    await updateToolRatingStats(review.toolId);

    const [tool] = await db
      .select({ slug: tools.slug })
      .from(tools)
      .where(eq(tools.id, review.toolId))
      .limit(1);

    if (tool) {
      revalidatePath(`/tools/${tool.slug}`);
    }

    return { success: true } as const;
  });

// ---------------------------------------------------------------------------
// 5. 获取工具评论（服务端，用于 JSON-LD 结构化数据）
// ---------------------------------------------------------------------------
export async function getToolReviewsForSchema(toolId: string) {
  const db = await getDb();

  const reviews = await db
    .select({
      rating: toolReviews.rating,
      comment: toolReviews.comment,
      createdAt: toolReviews.createdAt,
      userName: user.name,
    })
    .from(toolReviews)
    .innerJoin(user, eq(toolReviews.userId, user.id))
    .where(
      and(
        eq(toolReviews.toolId, toolId),
        eq(toolReviews.status, 'published'),
        isNotNull(toolReviews.comment),
        isNull(toolReviews.deletedAt)
      )
    )
    .orderBy(desc(toolReviews.createdAt))
    .limit(5);

  return reviews;
}

// ---------------------------------------------------------------------------
// 6. 获取评分分布（用于前端柱状图）
// ---------------------------------------------------------------------------
const getRatingDistributionSchema = z.object({
  toolId: z.string().min(1),
});

export const getRatingDistributionAction = actionClient
  .schema(getRatingDistributionSchema)
  .action(async ({ parsedInput }) => {
    const { toolId } = parsedInput;
    const db = await getDb();

    const result = await db
      .select({
        rating: toolReviews.rating,
        count: count(),
      })
      .from(toolReviews)
      .where(
        and(
          eq(toolReviews.toolId, toolId),
          eq(toolReviews.status, 'published'),
          isNull(toolReviews.deletedAt)
        )
      )
      .groupBy(toolReviews.rating);

    const distribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of result) {
      distribution[row.rating] = Number(row.count);
    }

    return { success: true, data: distribution } as const;
  });

// ===========================================================================
// Admin 评论管理功能
// ===========================================================================

// ---------------------------------------------------------------------------
// 7. 获取所有评论（Admin 专用，支持分页、筛选）
// ---------------------------------------------------------------------------
const getAllReviewsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  status: z.enum(['all', 'published', 'hidden']).default('all'),
  toolId: z.string().optional(),
  search: z.string().optional(),
});

export const getAllReviewsAction = actionClient
  .schema(getAllReviewsSchema)
  .action(async ({ parsedInput }) => {
    const { page, pageSize, status, toolId, search } = parsedInput;
    const db = await getDb();
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions = [isNull(toolReviews.deletedAt)];

    if (status !== 'all') {
      conditions.push(eq(toolReviews.status, status));
    }

    if (toolId) {
      conditions.push(eq(toolReviews.toolId, toolId));
    }

    if (search) {
      conditions.push(
        or(
          like(user.name, `%${search}%`),
          like(toolReviews.comment, `%${search}%`),
          like(tools.name, `%${search}%`)
        )
      );
    }

    const whereClause = and(...conditions);

    const [reviews, [{ total }]] = await Promise.all([
      db
        .select({
          id: toolReviews.id,
          toolId: toolReviews.toolId,
          userId: toolReviews.userId,
          rating: toolReviews.rating,
          comment: toolReviews.comment,
          status: toolReviews.status,
          createdAt: toolReviews.createdAt,
          updatedAt: toolReviews.updatedAt,
          userName: user.name,
          userImage: user.image,
          toolName: tools.name,
          toolSlug: tools.slug,
        })
        .from(toolReviews)
        .innerJoin(user, eq(toolReviews.userId, user.id))
        .innerJoin(tools, eq(toolReviews.toolId, tools.id))
        .where(whereClause)
        .orderBy(desc(toolReviews.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(toolReviews)
        .innerJoin(user, eq(toolReviews.userId, user.id))
        .innerJoin(tools, eq(toolReviews.toolId, tools.id))
        .where(whereClause),
    ]);

    return {
      success: true,
      data: {
        reviews,
        total: Number(total),
        page,
        pageSize,
        hasMore: offset + pageSize < Number(total),
      },
    } as const;
  });

// ---------------------------------------------------------------------------
// 8. 更新评论状态（Admin 专用，屏蔽/取消屏蔽）
// ---------------------------------------------------------------------------
const updateReviewStatusSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(['published', 'hidden']),
});

export const updateReviewStatusAction = actionClient
  .schema(updateReviewStatusSchema)
  .action(async ({ parsedInput }) => {
    const { reviewId, status } = parsedInput;
    const db = await getDb();

    const [review] = await db
      .select({ toolId: toolReviews.toolId })
      .from(toolReviews)
      .where(and(eq(toolReviews.id, reviewId), isNull(toolReviews.deletedAt)))
      .limit(1);

    if (!review) {
      return { success: false, error: 'Review not found' } as const;
    }

    await db
      .update(toolReviews)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(toolReviews.id, reviewId));

    // 更新工具评分统计
    await updateToolRatingStats(review.toolId);

    // 重新验证工具详情页
    const [tool] = await db
      .select({ slug: tools.slug })
      .from(tools)
      .where(eq(tools.id, review.toolId))
      .limit(1);

    if (tool) {
      revalidatePath(`/tools/${tool.slug}`);
    }

    return { success: true } as const;
  });

// ---------------------------------------------------------------------------
// 9. 软删除评论（Admin 专用）
// ---------------------------------------------------------------------------
const softDeleteReviewSchema = z.object({
  reviewId: z.string().min(1),
});

export const softDeleteReviewAction = actionClient
  .schema(softDeleteReviewSchema)
  .action(async ({ parsedInput }) => {
    const { reviewId } = parsedInput;
    const db = await getDb();

    const [review] = await db
      .select({ toolId: toolReviews.toolId })
      .from(toolReviews)
      .where(and(eq(toolReviews.id, reviewId), isNull(toolReviews.deletedAt)))
      .limit(1);

    if (!review) {
      return { success: false, error: 'Review not found' } as const;
    }

    await db
      .update(toolReviews)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(toolReviews.id, reviewId));

    // 更新工具评分统计
    await updateToolRatingStats(review.toolId);

    // 重新验证工具详情页
    const [tool] = await db
      .select({ slug: tools.slug })
      .from(tools)
      .where(eq(tools.id, review.toolId))
      .limit(1);

    if (tool) {
      revalidatePath(`/tools/${tool.slug}`);
    }

    return { success: true } as const;
  });

// ---------------------------------------------------------------------------
// 10. 获取评论统计（Admin 仪表板用）
// ---------------------------------------------------------------------------
export async function getReviewsStatsAction() {
  const db = await getDb();

  const [totalResult, publishedResult, hiddenResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(toolReviews)
      .where(isNull(toolReviews.deletedAt)),
    db
      .select({ count: count() })
      .from(toolReviews)
      .where(
        and(eq(toolReviews.status, 'published'), isNull(toolReviews.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(toolReviews)
      .where(
        and(eq(toolReviews.status, 'hidden'), isNull(toolReviews.deletedAt))
      ),
  ]);

  return {
    success: true,
    data: {
      total: Number(totalResult[0].count),
      published: Number(publishedResult[0].count),
      hidden: Number(hiddenResult[0].count),
    },
  };
}
