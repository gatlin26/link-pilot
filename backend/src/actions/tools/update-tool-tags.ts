'use server';

import { db } from '@/db';
import { toolTagTranslations, toolTags, tools } from '@/db/schema';
import { actionClient } from '@/lib/safe-action';
import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const updateToolTagsSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  tagSlugs: z.array(z.string()), // 使用 slug 而不是 ID，更直观
});

// ============================================================================
// Actions
// ============================================================================

/**
 * 更新工具的标签关联
 * 自动创建不存在的标签，直接更新 tools.tags JSON 字段
 */
export const updateToolTagsAction = actionClient
  .schema(updateToolTagsSchema)
  .action(async ({ parsedInput: { toolId, tagSlugs } }) => {
    try {
      // 1. 验证工具是否存在
      const tool = await db
        .select()
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1);

      if (!tool.length) {
        return {
          success: false,
          error: 'Tool not found',
        };
      }

      // 2. 获取或创建标签
      for (const slug of tagSlugs) {
        // 查找已存在的标签（只需查询主表）
        const existingTag = await db
          .select()
          .from(toolTags)
          .where(eq(toolTags.slug, slug))
          .limit(1);

        if (existingTag.length === 0) {
          // 自动创建新标签（使用事务）
          await db.transaction(async (tx) => {
            // 插入主表
            await tx.insert(toolTags).values({
              id: nanoid(),
              slug,
              category: 'general',
              status: 'published',
              sortOrder: 0,
              usageCount: 0,
            });

            // 插入英文翻译
            await tx.insert(toolTagTranslations).values({
              id: nanoid(),
              slug,
              locale: 'en',
              name: slug, // 默认使用 slug 作为名称
              description: null,
            });

            // 插入中文翻译
            await tx.insert(toolTagTranslations).values({
              id: nanoid(),
              slug,
              locale: 'zh',
              name: slug, // 默认使用 slug 作为名称
              description: null,
            });
          });
        }
      }

      // 3. 更新工具的 tags JSON 字段
      await db
        .update(tools)
        .set({
          tags: JSON.stringify(tagSlugs),
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      // 4. 更新标签使用计数（使用 JSONB 操作符精确匹配）
      await db.execute(sql`
        UPDATE tool_tags
        SET usage_count = (
          SELECT COUNT(*)
          FROM tools
          WHERE tags::jsonb @> jsonb_build_array(tool_tags.slug)
        ),
        updated_at = NOW()
      `);

      revalidatePath('/admin/tools');
      revalidatePath('/tools');

      return {
        success: true,
        data: { toolId, tagCount: tagSlugs.length },
      };
    } catch (error) {
      console.error('Error updating tool tags:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update tool tags',
      };
    }
  });

/**
 * 获取工具的标签列表
 * 从 tools.tags JSON 字段读取
 */
export const getToolTagsAction = actionClient
  .schema(z.object({ toolId: z.string(), locale: z.string().default('en') }))
  .action(async ({ parsedInput: { toolId, locale } }) => {
    try {
      // 获取工具的 tags JSON 字段
      const tool = await db.query.tools.findFirst({
        where: eq(tools.id, toolId),
        columns: {
          tags: true,
        },
      });

      if (!tool || !tool.tags) {
        return {
          success: true,
          data: [],
        };
      }

      // 解析 tags JSON
      const tagSlugs = JSON.parse(tool.tags) as string[];

      if (tagSlugs.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // 查询标签详情（使用 JOIN）
      const tags = await db
        .select({
          id: toolTags.id,
          slug: toolTags.slug,
          category: toolTags.category,
          status: toolTags.status,
          name: toolTagTranslations.name,
        })
        .from(toolTags)
        .innerJoin(
          toolTagTranslations,
          eq(toolTags.slug, toolTagTranslations.slug)
        )
        .where(
          and(
            sql`${toolTags.slug} = ANY(${tagSlugs})`,
            eq(toolTagTranslations.locale, locale)
          )
        );

      return {
        success: true,
        data: tags,
      };
    } catch (error) {
      console.error('Error getting tool tags:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get tool tags',
      };
    }
  });
