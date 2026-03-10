'use server';

import { getDb } from '@/db';
import { imageRecord, user } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { and, asc, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

const getAdminGenerationsSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  type: z
    .enum(['generate', 'enhance', 'edit', 'inpaint', 'outpaint', 'upscale'])
    .optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sorting: z
    .array(
      z.object({
        id: z.string(),
        desc: z.boolean(),
      })
    )
    .optional()
    .default([]),
});

const sortFieldMap = {
  createdAt: imageRecord.createdAt,
  status: imageRecord.status,
  type: imageRecord.type,
  creditsUsed: imageRecord.creditsUsed,
  userEmail: user.email,
} as const;

export const getAdminGenerationsAction = adminActionClient
  .schema(getAdminGenerationsSchema)
  .action(async ({ parsedInput }) => {
    try {
      const {
        pageIndex,
        pageSize,
        search,
        status,
        type,
        dateFrom,
        dateTo,
        sorting,
      } = parsedInput;

      const conditions = [];

      if (search) {
        conditions.push(ilike(user.email, `%${search}%`));
      }

      if (status) {
        conditions.push(eq(imageRecord.status, status));
      }

      if (type) {
        conditions.push(eq(imageRecord.type, type));
      }

      if (dateFrom) {
        conditions.push(gte(imageRecord.createdAt, new Date(dateFrom)));
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(imageRecord.createdAt, endDate));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;
      const offset = pageIndex * pageSize;

      const sortConfig = sorting[0];
      const sortField = sortConfig?.id
        ? sortFieldMap[sortConfig.id as keyof typeof sortFieldMap]
        : imageRecord.createdAt;
      const sortDirection = sortConfig?.desc !== false ? desc : asc;

      const db = await getDb();

      const [items, [{ count }]] = await Promise.all([
        db
          .select({
            id: imageRecord.id,
            userId: imageRecord.userId,
            type: imageRecord.type,
            status: imageRecord.status,
            prompt: imageRecord.prompt,
            provider: imageRecord.provider,
            model: imageRecord.model,
            inputUrl: imageRecord.inputUrl,
            outputUrl: imageRecord.outputUrl,
            creditsUsed: imageRecord.creditsUsed,
            errorMessage: imageRecord.errorMessage,
            createdAt: imageRecord.createdAt,
            taskId: imageRecord.taskId,
            inputImageUrls: imageRecord.inputImageUrls,
            userName: user.name,
            userEmail: user.email,
          })
          .from(imageRecord)
          .leftJoin(user, eq(imageRecord.userId, user.id))
          .where(whereClause)
          .orderBy(sortDirection(sortField))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql`count(*)` })
          .from(imageRecord)
          .leftJoin(user, eq(imageRecord.userId, user.id))
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
      console.error('get admin generations error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch generations';
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

export type GenerationRecord = {
  id: string;
  userId: string;
  type: string;
  status: string;
  prompt: string | null;
  provider: string | null;
  model: string | null;
  inputUrl: string | null;
  outputUrl: string | null;
  creditsUsed: number;
  errorMessage: string | null;
  createdAt: Date | null;
  taskId: string | null;
  inputImageUrls: string | null;
  userName: string | null;
  userEmail: string | null;
};
