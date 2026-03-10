'use server';

import { db, getExecuteRows } from '@/db';
import {
  toolTagTranslations,
  toolTags,
  toolTranslations,
  tools,
} from '@/db/schema';
import { actionClient } from '@/lib/safe-action';
import {
  getToolTagSimilarityWeight,
  isSuitableRelatedTool,
  sortToolTagsByCategory,
  sortToolTagsBySimilarity,
} from '@/lib/tool-tags';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

const getRelatedToolsSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  locale: z.string().default('en'),
  limit: z.number().min(1).max(20).default(12),
});

interface CurrentToolTag {
  slug: string;
  name: string;
  category: string | null;
  sortOrder: number | null;
}

interface RelatedToolRow {
  id: string;
  slug: string;
  name: string;
  url: string;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  featured: boolean;
  tags: string | null;
  matchCount: number | string;
  relevanceScore: number | string;
}

export const getRelatedToolsAction = actionClient
  .schema(getRelatedToolsSchema)
  .action(async ({ parsedInput: { toolId, locale, limit } }) => {
    try {
      const currentTool = await db.query.tools.findFirst({
        where: eq(tools.id, toolId),
        columns: { tags: true },
      });

      if (!currentTool?.tags) {
        return {
          success: false,
          error: 'Tool not found or has no tags',
        };
      }

      const currentTagSlugs = JSON.parse(currentTool.tags) as string[];
      if (currentTagSlugs.length === 0) {
        return {
          success: true,
          data: {
            tools: [],
            totalCount: 0,
          },
        };
      }

      const enTranslation = alias(toolTagTranslations, 'en_translation');
      const currentTagRows = await db
        .select({
          slug: toolTags.slug,
          category: toolTags.category,
          sortOrder: toolTags.sortOrder,
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
        .where(
          and(
            inArray(toolTags.slug, currentTagSlugs),
            eq(toolTags.status, 'published')
          )
        );

      const currentTagMap = new Map(
        currentTagRows.map((tag) => [
          tag.slug,
          {
            slug: tag.slug,
            name: tag.name || tag.slug,
            category: tag.category,
            sortOrder: tag.sortOrder,
          },
        ])
      );

      const currentTags = sortToolTagsByCategory(
        currentTagSlugs.map(
          (tagSlug) =>
            currentTagMap.get(tagSlug) || {
              slug: tagSlug,
              name: tagSlug,
              category: null,
              sortOrder: null,
            }
        )
      );

      const weightedTags = currentTags.map((tag) => ({
        slug: tag.slug,
        weight: getToolTagSimilarityWeight(tag.category),
      }));

      const candidateLimit = Math.min(Math.max(limit * 4, limit), 48);

      const relatedToolsResult = await db.execute(sql`
        WITH current_tags(slug, weight) AS (
          VALUES ${sql.join(
            weightedTags.map(
              (tag) => sql`(${tag.slug}::text, ${tag.weight}::integer)`
            ),
            sql`, `
          )}
        )
        SELECT
          t.id,
          t.slug,
          t.name,
          t.url,
          t.icon_url AS "iconUrl",
          t.thumbnail_url AS "thumbnailUrl",
          t.featured,
          t.tags,
          COUNT(DISTINCT current_tags.slug) AS "matchCount",
          COALESCE(SUM(current_tags.weight), 0) AS "relevanceScore"
        FROM tools t
        JOIN LATERAL jsonb_array_elements_text(COALESCE(t.tags, '[]')::jsonb) AS tag(value) ON TRUE
        JOIN current_tags ON current_tags.slug = tag.value
        WHERE t.id != ${toolId}
          AND t.published = true
        GROUP BY t.id
        ORDER BY "relevanceScore" DESC, "matchCount" DESC, t.featured DESC, t.created_at DESC
        LIMIT ${candidateLimit}
      `);

      const relatedTools = getExecuteRows(
        relatedToolsResult as unknown as
          | RelatedToolRow[]
          | { rows: RelatedToolRow[] }
      );
      const toolIds = relatedTools.map((tool) => tool.id);

      if (toolIds.length === 0) {
        return {
          success: true,
          data: {
            tools: [],
            totalCount: 0,
            matchedTags: currentTags,
          },
        };
      }

      const translations = await db
        .select({
          toolId: toolTranslations.toolId,
          locale: toolTranslations.locale,
          description: toolTranslations.description,
        })
        .from(toolTranslations)
        .where(
          and(
            inArray(toolTranslations.toolId, toolIds),
            inArray(toolTranslations.locale, [locale, 'en'])
          )
        );

      const translationMap = new Map<string, { description: string | null }>();
      for (const translation of translations) {
        const existingTranslation = translationMap.get(translation.toolId);
        if (!existingTranslation || translation.locale === locale) {
          translationMap.set(translation.toolId, {
            description: translation.description,
          });
        }
      }

      const currentTagLookup = new Map(
        currentTags.map((tag) => [tag.slug, tag])
      );

      const candidateTools = relatedTools.map((tool) => {
        const relatedTagSlugs = tool.tags
          ? (JSON.parse(tool.tags) as string[])
          : [];
        const matchedTags = sortToolTagsBySimilarity(
          relatedTagSlugs
            .map((tagSlug) => currentTagLookup.get(tagSlug))
            .filter((tag): tag is CurrentToolTag => Boolean(tag))
        );

        return {
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          url: tool.url,
          iconUrl: tool.iconUrl,
          thumbnailUrl: tool.thumbnailUrl,
          featured: tool.featured,
          matchCount: Number(tool.matchCount),
          relevanceScore: Number(tool.relevanceScore),
          matchedTags,
          translation: translationMap.get(tool.id) || null,
        };
      });

      const strictTools = candidateTools.filter((tool) =>
        isSuitableRelatedTool(tool.matchedTags)
      );

      const toolsWithTranslations =
        strictTools.length >= limit
          ? strictTools.slice(0, limit)
          : candidateTools.slice(0, limit);

      return {
        success: true,
        data: {
          tools: toolsWithTranslations,
          totalCount: toolsWithTranslations.length,
          matchedTags: currentTags,
        },
      };
    } catch (error) {
      console.error('Error getting related tools:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get related tools',
      };
    }
  });
