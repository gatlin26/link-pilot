'use server';

import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { toolTranslations, tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const translationSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  introduction: z.string().default(''),
});

const updateToolSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  // 基础信息
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  tags: z.array(z.string()),
  featured: z.boolean(),
  published: z.boolean(),
  // 图片字段
  iconUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  screenshots: z.array(z.string().url()).default([]),
  // 多语言翻译
  translations: z.record(
    z.enum(['en', 'zh', 'zh-TW', 'ko', 'ja', 'pt', 'es', 'de', 'fr', 'vi']),
    translationSchema
  ),
});

/**
 * 更新工具（仅管理员）
 */
export const updateToolAction = adminActionClient
  .schema(updateToolSchema)
  .action(async ({ parsedInput }) => {
    try {
      const {
        toolId,
        name,
        url,
        tags,
        featured,
        published,
        iconUrl,
        thumbnailUrl,
        imageUrl,
        screenshots,
        translations,
      } = parsedInput;

      const db = await getDb();

      // 获取当前工具信息
      const existingTool = await db
        .select({ slug: tools.slug })
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (existingTool.length === 0) {
        return { success: false, error: 'Tool not found' };
      }

      const slug = existingTool[0].slug;

      // 1. 更新工具主记录
      await db
        .update(tools)
        .set({
          name,
          url,
          tags: JSON.stringify(tags),
          featured,
          published,
          iconUrl: iconUrl || null,
          thumbnailUrl: thumbnailUrl || null,
          imageUrl: imageUrl || null,
          screenshots:
            screenshots.length > 0 ? JSON.stringify(screenshots) : null,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      // 2. upsert 所有语言翻译（先批量查出已有 locale，避免 N+1）
      const existingTranslations = await db
        .select({ locale: toolTranslations.locale })
        .from(toolTranslations)
        .where(eq(toolTranslations.toolId, toolId));

      const existingLocales = new Set(
        existingTranslations.map((t) => t.locale)
      );

      for (const [locale, content] of Object.entries(translations)) {
        if (!content.title || !content.description || !content.introduction) {
          continue;
        }

        if (existingLocales.has(locale)) {
          await db
            .update(toolTranslations)
            .set({
              title: content.title,
              description: content.description,
              introduction: content.introduction,
              updatedAt: new Date(),
            })
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
            title: content.title,
            description: content.description,
            introduction: content.introduction,
          });
        }
      }

      // 3. 触发 ISR 重新验证
      const locales = Object.keys(websiteConfig.i18n.locales);
      for (const locale of locales) {
        if (locale === websiteConfig.i18n.defaultLocale) {
          revalidatePath('/tools');
          revalidatePath(`/tools/${slug}`);
        } else {
          revalidatePath(`/${locale}/tools`);
          revalidatePath(`/${locale}/tools/${slug}`);
        }
      }

      return { success: true, message: 'Tool updated successfully' } as const;
    } catch (error) {
      console.error('update tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update tool',
      };
    }
  });
