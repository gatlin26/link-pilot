'use server';

import { getDb } from '@/db';
import { tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const deleteToolSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
});

/**
 * 删除工具（仅管理员）
 * toolTranslations 会通过外键级联删除
 */
export const deleteToolAction = adminActionClient
  .schema(deleteToolSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId } = parsedInput;
      const db = await getDb();

      // 获取工具信息用于 ISR 重新验证
      const existingTool = await db
        .select({ slug: tools.slug })
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (existingTool.length === 0) {
        return {
          success: false,
          error: 'Tool not found',
        };
      }

      const slug = existingTool[0].slug;

      // 删除工具（toolTranslations 会级联删除）
      await db.delete(tools).where(eq(tools.id, toolId));

      // 触发 ISR 重新验证
      revalidatePath('/tools');
      revalidatePath('/zh/tools');
      revalidatePath(`/tools/${slug}`);
      revalidatePath(`/zh/tools/${slug}`);

      return {
        success: true,
        message: 'Tool deleted successfully',
      } as const;
    } catch (error) {
      console.error('delete tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete tool',
      };
    }
  });
