'use server';

import { db } from '@/db';
import { toolTagTranslations, toolTags, tools } from '@/db/schema';
import { actionClient } from '@/lib/safe-action';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const getTagBySlugSchema = z.object({
  slug: z.string().min(1),
});

// ============================================================================
// Actions
// ============================================================================

/**
 * 获取所有已发布的标签（用于标签列表页）
 * 使用翻译回退机制：优先使用指定语言，缺失时回退到英文
 */
export async function getAllPublishedTags(locale = 'en') {
  try {
    // 创建英文翻译表的别名
    const enTranslation = alias(toolTagTranslations, 'en_translation');

    // JOIN 查询：主表 + 当前语言翻译 + 英文翻译（回退）
    const tags = await db
      .select({
        // 主表字段
        id: toolTags.id,
        slug: toolTags.slug,
        category: toolTags.category,
        status: toolTags.status,
        sortOrder: toolTags.sortOrder,
        usageCount: toolTags.usageCount,
        createdAt: toolTags.createdAt,
        updatedAt: toolTags.updatedAt,
        // 翻译字段（使用 COALESCE 回退到英文）
        name: sql<string>`COALESCE(${toolTagTranslations.name}, ${enTranslation.name})`.as(
          'name'
        ),
        description: sql<
          string | null
        >`COALESCE(${toolTagTranslations.description}, ${enTranslation.description})`.as(
          'description'
        ),
        content: sql<
          string | null
        >`COALESCE(${toolTagTranslations.content}, ${enTranslation.content})`.as(
          'content'
        ),
      })
      .from(toolTags)
      .leftJoin(
        toolTagTranslations,
        and(
          eq(toolTags.slug, toolTagTranslations.slug),
          eq(toolTagTranslations.locale, locale)
        )
      )
      .leftJoin(
        enTranslation,
        and(
          eq(toolTags.slug, enTranslation.slug),
          eq(enTranslation.locale, 'en')
        )
      )
      .where(eq(toolTags.status, 'published'))
      .orderBy(desc(toolTags.usageCount), desc(toolTags.sortOrder));

    return tags;
  } catch (error) {
    console.error('Get all tags error:', error);
    return [];
  }
}

/**
 * 根据 slug 获取标签详情
 * 使用翻译回退机制：优先使用指定语言，缺失时回退到英文
 */
export async function getTagBySlug(slug: string, locale = 'en') {
  try {
    // 创建英文翻译表的别名
    const enTranslation = alias(toolTagTranslations, 'en_translation');

    const tag = await db
      .select({
        id: toolTags.id,
        slug: toolTags.slug,
        category: toolTags.category,
        status: toolTags.status,
        sortOrder: toolTags.sortOrder,
        usageCount: toolTags.usageCount,
        createdAt: toolTags.createdAt,
        updatedAt: toolTags.updatedAt,
        // 翻译字段（使用 COALESCE 回退到英文）
        name: sql<string>`COALESCE(${toolTagTranslations.name}, ${enTranslation.name})`.as(
          'name'
        ),
        description: sql<
          string | null
        >`COALESCE(${toolTagTranslations.description}, ${enTranslation.description})`.as(
          'description'
        ),
        content: sql<
          string | null
        >`COALESCE(${toolTagTranslations.content}, ${enTranslation.content})`.as(
          'content'
        ),
      })
      .from(toolTags)
      .leftJoin(
        toolTagTranslations,
        and(
          eq(toolTags.slug, toolTagTranslations.slug),
          eq(toolTagTranslations.locale, locale)
        )
      )
      .leftJoin(
        enTranslation,
        and(
          eq(toolTags.slug, enTranslation.slug),
          eq(enTranslation.locale, 'en')
        )
      )
      .where(and(eq(toolTags.slug, slug), eq(toolTags.status, 'published')))
      .limit(1);

    return tag[0] || null;
  } catch (error) {
    console.error('Error getting tag by slug:', error);
    return null;
  }
}

/**
 * 获取标签下的所有工具
 * 从 tools.tags JSON 字段查询
 */
export async function getToolsByTagSlug(slug: string, locale = 'en') {
  try {
    const tag = await getTagBySlug(slug, locale);
    if (!tag) {
      return [];
    }

    // 查询 tags JSON 字段包含该标签 slug 的所有已发布工具
    const toolsWithTag = await db.query.tools.findMany({
      where: and(
        eq(tools.published, true),
        sql`${tools.tags}::jsonb @> ${JSON.stringify([slug])}::jsonb`
      ),
      orderBy: [desc(tools.featured), desc(tools.createdAt)],
    });

    // 获取每个工具的翻译
    const toolsWithTranslations = await Promise.all(
      toolsWithTag.map(async (tool) => {
        const translations = await db.query.toolTranslations.findMany({
          where: (toolTranslations, { eq }) =>
            eq(toolTranslations.toolId, tool.id),
        });

        return {
          ...tool,
          translations,
        };
      })
    );

    return toolsWithTranslations;
  } catch (error) {
    console.error('Error getting tools by tag:', error);
    return [];
  }
}

/**
 * 获取所有标签的 slug（用于静态生成）
 */
export async function getAllTagSlugs() {
  try {
    // 只查询主表，不需要 JOIN
    const tags = await db
      .selectDistinct({ slug: toolTags.slug })
      .from(toolTags)
      .where(eq(toolTags.status, 'published'));

    return tags.map((tag) => tag.slug);
  } catch (error) {
    console.error('Error getting tag slugs:', error);
    return [];
  }
}

/**
 * 获取相关标签（同 category 的其他标签）
 * 用于标签详情页的"相关标签"推荐
 */
export async function getRelatedTags(
  currentSlug: string,
  category: string | null,
  locale = 'en',
  limit = 6
) {
  try {
    // 如果没有 category，返回空数组
    if (!category) {
      return [];
    }

    // 创建英文翻译表的别名
    const enTranslation = alias(toolTagTranslations, 'en_translation');

    const tags = await db
      .select({
        id: toolTags.id,
        slug: toolTags.slug,
        category: toolTags.category,
        usageCount: toolTags.usageCount,
        // 翻译字段（使用 COALESCE 回退到英文）
        name: sql<string>`COALESCE(${toolTagTranslations.name}, ${enTranslation.name})`.as(
          'name'
        ),
        description: sql<
          string | null
        >`COALESCE(${toolTagTranslations.description}, ${enTranslation.description})`.as(
          'description'
        ),
      })
      .from(toolTags)
      .leftJoin(
        toolTagTranslations,
        and(
          eq(toolTags.slug, toolTagTranslations.slug),
          eq(toolTagTranslations.locale, locale)
        )
      )
      .leftJoin(
        enTranslation,
        and(
          eq(toolTags.slug, enTranslation.slug),
          eq(enTranslation.locale, 'en')
        )
      )
      .where(
        and(
          eq(toolTags.category, category),
          eq(toolTags.status, 'published'),
          ne(toolTags.slug, currentSlug)
        )
      )
      .orderBy(desc(toolTags.usageCount))
      .limit(limit);

    return tags;
  } catch (error) {
    console.error('Error getting related tags:', error);
    return [];
  }
}
