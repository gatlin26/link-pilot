'use server';

import { getDb } from '@/db';
import {
  toolTagTranslations,
  toolTags,
  toolTranslations,
  tools,
} from '@/db/schema';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';

/**
 * 工具列表查询参数
 */
export interface GetToolsParams {
  locale: string;
  page?: number;
  pageSize?: number;
  search?: string;
  featured?: boolean;
  published?: boolean;
}

/**
 * 工具列表项类型
 */
export interface ToolListItem {
  id: string;
  slug: string;
  name: string;
  url: string;
  tags: string[];
  tagDetails: { slug: string; name: string }[]; // 添加标签详情
  dr: number | null;
  mv: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  starRating: number | null;
  featured: boolean | null;
  published: boolean | null;
  collectionTime: Date | null;
  createdAt: Date;
  // 翻译字段
  title: string;
  description: string | null;
}

/**
 * 获取工具列表
 * 支持分页、搜索、筛选
 */
export async function getTools(params: GetToolsParams): Promise<{
  items: ToolListItem[];
  total: number;
}> {
  const {
    locale,
    page = 1,
    pageSize = 20,
    search,
    featured,
    published = true,
  } = params;

  const db = await getDb();
  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const whereConditions = [];

  // 发布状态筛选
  if (published !== undefined) {
    whereConditions.push(eq(tools.published, published));
  }

  // 精选筛选
  if (featured !== undefined) {
    whereConditions.push(eq(tools.featured, featured));
  }

  // 语言筛选
  whereConditions.push(eq(toolTranslations.locale, locale));

  // 搜索条件
  if (search) {
    const searchCondition = or(
      ilike(tools.name, `%${search}%`),
      ilike(toolTranslations.title, `%${search}%`),
      ilike(toolTranslations.description, `%${search}%`)
    );
    if (searchCondition) {
      whereConditions.push(searchCondition);
    }
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // 查询数据
  const [items, [{ count }]] = await Promise.all([
    db
      .select({
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
        featured: tools.featured,
        published: tools.published,
        collectionTime: tools.collectionTime,
        createdAt: tools.createdAt,
        title: toolTranslations.title,
        description: toolTranslations.description,
      })
      .from(tools)
      .innerJoin(toolTranslations, eq(tools.id, toolTranslations.toolId))
      .where(whereClause)
      .orderBy(
        desc(tools.featured),
        desc(tools.collectionTime),
        desc(tools.createdAt)
      )
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tools)
      .innerJoin(toolTranslations, eq(tools.id, toolTranslations.toolId))
      .where(whereClause),
  ]);

  const parsedTagsByTool = items.map((item) => {
    try {
      return item.tags ? (JSON.parse(item.tags) as string[]) : [];
    } catch {
      return [];
    }
  });

  const uniqueTagSlugs = [...new Set(parsedTagsByTool.flat())];
  const tagNameBySlug = new Map<string, string>();

  if (uniqueTagSlugs.length > 0) {
    const tagsResult = await db
      .select({
        slug: toolTags.slug,
        name: toolTagTranslations.name,
      })
      .from(toolTags)
      .innerJoin(
        toolTagTranslations,
        eq(toolTags.slug, toolTagTranslations.slug)
      )
      .where(
        and(
          sql`${toolTags.slug} = ANY(ARRAY[${sql.join(
            uniqueTagSlugs.map((s) => sql`${s}`),
            sql`, `
          )}])`,
          eq(toolTagTranslations.locale, locale)
        )
      );

    for (const tag of tagsResult) {
      tagNameBySlug.set(tag.slug, tag.name);
    }
  }

  const parsedItems: ToolListItem[] = items.map((item, index) => {
    const tagSlugs = parsedTagsByTool[index] || [];
    const tagDetails = tagSlugs
      .map((slug) => {
        const localizedName = tagNameBySlug.get(slug);
        return localizedName ? { slug, name: localizedName } : null;
      })
      .filter((tag): tag is { slug: string; name: string } => tag !== null);

    return {
      ...item,
      tags: tagSlugs,
      tagDetails,
    };
  });

  return {
    items: parsedItems,
    total: Number(count),
  };
}

/**
 * 获取所有已发布工具的 slug（用于 generateStaticParams）
 */
export async function getAllToolSlugs(): Promise<string[]> {
  const db = await getDb();

  const result = await db
    .selectDistinct({ slug: tools.slug })
    .from(tools)
    .where(eq(tools.published, true));

  return result.map((r) => r.slug);
}
