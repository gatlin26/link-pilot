'use server';

import { getDb } from '@/db';
import { tools, user } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const getSubmissionDetailSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
});

export const getSubmissionDetailAction = adminActionClient
  .schema(getSubmissionDetailSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId } = parsedInput;
      const db = await getDb();

      const result = await db
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
          submitterUserId: tools.submitterUserId,
          submitterEmail: tools.submitterEmail,
          createdAt: tools.createdAt,
          updatedAt: tools.updatedAt,
          userName: user.name,
          userEmail: user.email,
        })
        .from(tools)
        .leftJoin(user, eq(tools.submitterUserId, user.id))
        .where(eq(tools.id, toolId))
        .limit(1);

      if (result.length === 0) {
        return {
          success: false,
          error: 'Tool not found',
        };
      }

      return {
        success: true,
        data: result[0],
      };
    } catch (error) {
      console.error('get submission detail error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch submission detail',
      };
    }
  });
