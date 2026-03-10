'use server';

import { getDb } from '@/db';
import { payment, toolSubmissions, tools, user } from '@/db/schema';
import { isDemoWebsite } from '@/lib/demo';
import { adminActionClient } from '@/lib/safe-action';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';

const emptySchema = z.object({});

/**
 * 获取 Admin 仪表盘统计数据（仅管理员）
 */
export const getDashboardStatsAction = adminActionClient
  .schema(emptySchema)
  .action(async () => {
    try {
      const db = await getDb();
      const isDemo = isDemoWebsite();

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        userCountResult,
        submissionCountResult,
        pendingCountResult,
        publishedToolsResult,
        newToolsResult,
        recentPayments,
        recentSubmissions,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(user),
        db.select({ count: sql<number>`count(*)` }).from(toolSubmissions),
        db
          .select({ count: sql<number>`count(*)` })
          .from(toolSubmissions)
          .where(eq(toolSubmissions.status, 'pending')),
        db
          .select({ count: sql<number>`count(*)` })
          .from(tools)
          .where(eq(tools.published, true)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(tools)
          .where(
            and(eq(tools.published, true), gte(tools.createdAt, thirtyDaysAgo))
          ),
        db
          .select({
            id: payment.id,
            type: payment.type,
            status: payment.status,
            createdAt: payment.createdAt,
            userId: payment.userId,
            userName: user.name,
            userEmail: user.email,
          })
          .from(payment)
          .leftJoin(user, eq(payment.userId, user.id))
          .orderBy(desc(payment.createdAt))
          .limit(10),
        db
          .select({
            id: toolSubmissions.id,
            name: toolSubmissions.name,
            status: toolSubmissions.status,
            email: toolSubmissions.email,
            createdAt: toolSubmissions.createdAt,
          })
          .from(toolSubmissions)
          .orderBy(desc(toolSubmissions.createdAt))
          .limit(10),
      ]);

      const stats = {
        userCount: Number(userCountResult[0]?.count ?? 0),
        submissionCount: Number(submissionCountResult[0]?.count ?? 0),
        pendingCount: Number(pendingCountResult[0]?.count ?? 0),
        publishedToolsCount: Number(publishedToolsResult[0]?.count ?? 0),
        newToolsCount: Number(newToolsResult[0]?.count ?? 0),
      };

      if (isDemo) {
        return {
          success: true,
          data: {
            stats: {
              userCount: 42,
              submissionCount: 15,
              pendingCount: 3,
              publishedToolsCount: 128,
              newToolsCount: 12,
            },
            recentPayments: [],
            recentSubmissions: [],
          },
        };
      }

      return {
        success: true,
        data: {
          stats,
          recentPayments,
          recentSubmissions,
        },
      };
    } catch (error) {
      console.error('get dashboard stats error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch dashboard stats',
      };
    }
  });
