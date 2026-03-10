'use server';

import { getDb } from '@/db';
import { toolTranslations } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const saveToolTranslationSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  locale: z.string().min(1, 'Locale is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  introduction: z.string().min(1, 'Introduction is required'),
});

/**
 * 保存单个语言翻译（upsert）
 * 用于一键填充时逐语言自动保存，防止中断丢失数据
 */
export const saveToolTranslationAction = adminActionClient
  .schema(saveToolTranslationSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId, locale, title, description, introduction } = parsedInput;
      const db = await getDb();

      // 检查是否已有该 locale 的翻译
      const existing = await db
        .select({ id: toolTranslations.id })
        .from(toolTranslations)
        .where(
          and(
            eq(toolTranslations.toolId, toolId),
            eq(toolTranslations.locale, locale)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(toolTranslations)
          .set({ title, description, introduction, updatedAt: new Date() })
          .where(
            and(
              eq(toolTranslations.toolId, toolId),
              eq(toolTranslations.locale, locale)
            )
          );
      } else {
        await db.insert(toolTranslations).values({
          id: nanoid(),
          toolId,
          locale,
          title,
          description,
          introduction,
        });
      }

      return { success: true } as const;
    } catch (error) {
      console.error('save tool translation error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to save translation',
      };
    }
  });
