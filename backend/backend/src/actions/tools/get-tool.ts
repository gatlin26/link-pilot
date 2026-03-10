'use server';

import { getTagDefinition } from '@/config/tag-definitions';
import { getDb } from '@/db';
import {
  toolTagTranslations,
  toolTags,
  toolTranslations,
  tools,
} from '@/db/schema';
import { sortToolTagsBySimilarity } from '@/lib/tool-tags';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

function normalizeTagKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

const LEGACY_TOOL_TAG_CATEGORY_MAP: Record<string, string> = {
  'drawing-aid': 'type',
  'no-login-required': 'general',
  'real-time-preview': 'feature',
};

/**
 * 工具详情类型
 */
export interface ToolDetail {
  id: string;
  slug: string;
  name: string;
  url: string;
  tags: string[];
  tagDetails: {
    slug: string;
    name: string;
    category: string | null;
    sortOrder: number | null;
    status: string | null;
  }[];
  dr: number | null;
  mv: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  starRating: number | null;
  avgRating: string | null;
  reviewCount: number | null;
  featured: boolean | null;
  published: boolean | null;
  collectionTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  description: string | null;
  introduction: string | null;
}

/**
 * 根据 slug 和语言获取工具详情
 * 若无对应语言翻译，自动 fallback 到英文
 */
export async function getToolBySlug(
  slug: string,
  locale: string
): Promise<ToolDetail | null> {
  const db = await getDb();

  const toolSelectFields = {
    id: tools.id,
    slug: tools.slug,
    name: tools.name,
    url: tools.url,
    tags: tools.tags,
    dr: tools.dr,
    mv: tools.mv,
    iconUrl: tools.iconUrl,
    imageUrl: tools.imageUrl,
    thumbnailUrl: tools.thumbnailUrl,
    starRating: tools.starRating,
    avgRating: tools.avgRating,
    reviewCount: tools.reviewCount,
    featured: tools.featured,
    published: tools.published,
    collectionTime: tools.collectionTime,
    createdAt: tools.createdAt,
    updatedAt: tools.updatedAt,
    title: toolTranslations.title,
    description: toolTranslations.description,
    introduction: toolTranslations.introduction,
  };

  const result = await db
    .select(toolSelectFields)
    .from(tools)
    .innerJoin(toolTranslations, eq(tools.id, toolTranslations.toolId))
    .where(
      and(
        eq(tools.slug, slug),
        eq(toolTranslations.locale, locale),
        eq(tools.published, true)
      )
    )
    .limit(1);

  let finalRow = result.length > 0 ? result[0] : null;
  if (!finalRow && locale !== 'en') {
    const enResult = await db
      .select(toolSelectFields)
      .from(tools)
      .innerJoin(toolTranslations, eq(tools.id, toolTranslations.toolId))
      .where(
        and(
          eq(tools.slug, slug),
          eq(toolTranslations.locale, 'en'),
          eq(tools.published, true)
        )
      )
      .limit(1);
    finalRow = enResult.length > 0 ? enResult[0] : null;
  }

  if (!finalRow) {
    return null;
  }

  const item = finalRow;
  const rawTags: string[] = item.tags ? JSON.parse(item.tags) : [];
  const normalizedTagKeys = Array.from(
    new Set(rawTags.map((tag) => normalizeTagKey(tag)))
  );

  let tagDetails: ToolDetail['tagDetails'] = [];
  if (normalizedTagKeys.length > 0) {
    const enTranslation = alias(toolTagTranslations, 'en_translation');

    const tagsResult = await db
      .select({
        slug: toolTags.slug,
        category: toolTags.category,
        sortOrder: toolTags.sortOrder,
        status: toolTags.status,
        name: sql<string>`COALESCE(${toolTagTranslations.name}, ${enTranslation.name}, ${toolTags.slug})`.as(
          'name'
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
      .where(inArray(toolTags.slug, normalizedTagKeys));

    const tagMap = new Map(
      tagsResult.map((tag) => [
        tag.slug,
        {
          slug: tag.slug,
          name: tag.name,
          category: tag.category,
          sortOrder: tag.sortOrder,
          status: tag.status,
        },
      ])
    );

    tagDetails = sortToolTagsBySimilarity(
      rawTags.map((rawTag) => {
        const normalizedTag = normalizeTagKey(rawTag);
        const tagDefinition = getTagDefinition(normalizedTag);

        return (
          tagMap.get(normalizedTag) || {
            slug: normalizedTag,
            name: rawTag,
            category:
              tagDefinition?.category ||
              LEGACY_TOOL_TAG_CATEGORY_MAP[normalizedTag] ||
              null,
            sortOrder: null,
            status: null,
          }
        );
      })
    );
  }

  return {
    ...item,
    tags: normalizedTagKeys,
    tagDetails,
  };
}

/**
 * 根据 ID 获取工具（包含所有翻译）
 * 用于管理后台编辑
 */
export async function getToolById(toolId: string): Promise<{
  tool: {
    id: string;
    slug: string;
    name: string;
    url: string;
    tags: string[];
    dr: number | null;
    mv: string | null;
    iconUrl: string | null;
    imageUrl: string | null;
    thumbnailUrl: string | null;
    starRating: number | null;
    featured: boolean | null;
    published: boolean | null;
    collectionTime: Date | null;
  };
  translations: {
    locale: string;
    title: string;
    description: string | null;
    introduction: string | null;
  }[];
} | null> {
  const db = await getDb();

  const toolResult = await db
    .select()
    .from(tools)
    .where(eq(tools.id, toolId))
    .limit(1);

  if (toolResult.length === 0) {
    return null;
  }

  const tool = toolResult[0];

  const translationsResult = await db
    .select({
      locale: toolTranslations.locale,
      title: toolTranslations.title,
      description: toolTranslations.description,
      introduction: toolTranslations.introduction,
    })
    .from(toolTranslations)
    .where(eq(toolTranslations.toolId, toolId));

  return {
    tool: {
      ...tool,
      tags: tool.tags ? JSON.parse(tool.tags) : [],
    },
    translations: translationsResult,
  };
}
