'use server';

import { websiteConfig } from '@/config/website';
import { getDb } from '@/db';
import { toolTranslations, tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

/**
 * 生成 URL slug
 */
function generateSlug(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname
      .replace(/^www\./, '')
      .replace(/\./g, '-')
      .toLowerCase();
  } catch {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\//g, '')
      .replace(/\./g, '-')
      .toLowerCase();
  }
}

const translationSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  introduction: z.string().default(''),
});

const createToolSchema = z.object({
  // 基础信息
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  tags: z.array(z.string()),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
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
 * 创建新工具（仅管理员）
 */
export const createToolAction = adminActionClient
  .schema(createToolSchema)
  .action(async ({ parsedInput }) => {
    try {
      const {
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

      // 生成 slug
      const slug = generateSlug(url);

      // 检查 slug 是否已存在
      const existingTool = await db
        .select({ id: tools.id })
        .from(tools)
        .where(eq(tools.slug, slug))
        .limit(1);

      if (existingTool.length > 0) {
        return {
          success: false,
          error: `Tool with slug "${slug}" already exists`,
        };
      }

      // 1. 创建工具主记录
      const toolId = nanoid();
      await db.insert(tools).values({
        id: toolId,
        slug,
        name,
        url,
        tags: JSON.stringify(tags),
        starRating: 5,
        featured,
        published,
        iconUrl: iconUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        imageUrl: imageUrl || null,
        screenshots:
          screenshots.length > 0 ? JSON.stringify(screenshots) : null,
        collectionTime: new Date(),
      });

      // 2. 插入所有语言翻译
      for (const [locale, content] of Object.entries(translations)) {
        if (content.title && content.description && content.introduction) {
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

      return {
        success: true,
        message: 'Tool created successfully',
        data: { toolId, slug },
      } as const;
    } catch (error) {
      console.error('create tool error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tool',
      };
    }
  });
