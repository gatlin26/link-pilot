'use server';

import { getDb } from '@/db';
import { imageRecord } from '@/db/schema';
import type { User } from '@/lib/auth-types';
import { userActionClient } from '@/lib/safe-action';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const getImageHistorySchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(50).default(12),
});

export const getImageHistoryAction = userActionClient
  .schema(getImageHistorySchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const { pageIndex, pageSize } = parsedInput;
      const currentUser = (ctx as { user: User }).user;

      const offset = pageIndex * pageSize;
      const where = eq(imageRecord.userId, currentUser.id);

      const db = await getDb();
      const [items, [{ count }]] = await Promise.all([
        db
          .select({
            id: imageRecord.id,
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
          })
          .from(imageRecord)
          .where(where)
          .orderBy(desc(imageRecord.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql`count(*)` }).from(imageRecord).where(where),
      ]);

      return {
        success: true,
        data: {
          items,
          total: Number(count),
        },
      };
    } catch (error) {
      console.error('get image history error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch image history',
      };
    }
  });
