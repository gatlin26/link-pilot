'use server';

import { getDb } from '@/db';
import { toolTranslations, tools } from '@/db/schema';
import { adminActionClient } from '@/lib/safe-action';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const getToolDetailSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
});

/**
 * 获取工具详情（包含所有翻译）
 * 用于编辑工具时获取完整数据
 */
export const getToolDetailAction = adminActionClient
  .schema(getToolDetailSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId } = parsedInput;
      const db = await getDb();

      // 获取工具基础信息
      const toolData = await db
        .select()
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (toolData.length === 0) {
        return { success: false, error: 'Tool not found' };
      }

      const tool = toolData[0];

      // 获取所有翻译
      const translationsResult = await db
        .select({
          locale: toolTranslations.locale,
          title: toolTranslations.title,
          description: toolTranslations.description,
          introduction: toolTranslations.introduction,
        })
        .from(toolTranslations)
        .where(eq(toolTranslations.toolId, toolId));

      // 将翻译数组转换为 Record<locale, {title, description, introduction}>
      const translations: Record<
        string,
        { title: string; description: string; introduction: string }
      > = {};
      for (const t of translationsResult) {
        translations[t.locale] = {
          title: t.title,
          description: t.description ?? '',
          introduction: t.introduction ?? '',
        };
      }

      return {
        success: true,
        data: {
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          url: tool.url,
          tags: tool.tags,
          featured: tool.featured,
          published: tool.published,
          status: tool.status,
          submitterEmail: tool.submitterEmail,
          iconUrl: tool.iconUrl,
          thumbnailUrl: tool.thumbnailUrl,
          imageUrl: tool.imageUrl,
          translations,
        },
      };
    } catch (error) {
      console.error('get tool detail error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch tool detail',
      };
    }
  });
