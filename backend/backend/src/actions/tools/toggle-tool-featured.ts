'use server';

import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const toggleFeaturedSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  featured: z.boolean(),
});

/**
 * 切换工具精选状态（仅管理员）
 */
export const toggleToolFeaturedAction = adminActionClient
  .schema(toggleFeaturedSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId, featured } = parsedInput;
      const db = await getDb();

      const [existingTool] = await db
        .select({ slug: tools.slug })
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (!existingTool) {
        return { success: false, error: 'Tool not found' };
      }

      await db
        .update(tools)
        .set({ featured, updatedAt: new Date() })
        .where(eq(tools.id, toolId));

      const slug = existingTool.slug;
      const locales = Object.keys(websiteConfig.i18n.locales);
      const defaultLocale = websiteConfig.i18n.defaultLocale;

      for (const locale of locales) {
        if (locale === defaultLocale) {
          revalidatePath('/tools');
          revalidatePath(`/tools/${slug}`);
        } else {
          revalidatePath(`/${locale}/tools`);
          revalidatePath(`/${locale}/tools/${slug}`);
        }
      }

      return { success: true, featured } as const;
    } catch (error) {
      console.error('toggle tool featured error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to toggle featured',
      };
    }
  });
