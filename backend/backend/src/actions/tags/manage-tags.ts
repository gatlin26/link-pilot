'use server';

import { websiteConfig } from '@/config/website';
import { db } from '@/db';
import {
  toolTagTranslations,
  toolTags,
  toolTranslations,
  tools,
} from '@/db/schema';
import {
  callEvolinkAPIWithRetry,
  parseAIJsonResponse,
  sanitizeForPrompt,
} from '@/lib/ai-utils';
import { actionClient } from '@/lib/safe-action';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

// ============================================================================
// Schema
// ============================================================================

const createTagSchema = z.object({
  slug: z.string().min(1).max(50),
  enName: z.string().min(1).max(100),
  zhName: z.string().min(1).max(100),
  enDescription: z.string().optional(),
  zhDescription: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

const updateTagSchema = z.object({
  slug: z.string().min(1).max(50),
  // 主表字段
  category: z.string().optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  // 翻译字段
  enName: z.string().min(1).max(100).optional(),
  zhName: z.string().min(1).max(100).optional(),
  enDescription: z.string().optional().nullable(),
  zhDescription: z.string().optional().nullable(),
});

const linkToolToTagsSchema = z.object({
  toolId: z.string(),
  tagSlugs: z.array(z.string()),
});

const updateTagBatchSchema = z.object({
  slug: z.string().min(1).max(50),
  common: z
    .object({
      category: z.string().optional().nullable(),
      status: z.enum(['draft', 'published', 'archived']).optional(),
    })
    .optional(),
  translations: z.array(
    z.object({
      locale: z.string(),
      name: z.string().optional(),
      description: z.string().optional().nullable(),
      content: z.string().optional().nullable(),
    })
  ),
});

const autofillTagTranslationsSchema = z.object({
  slug: z.string().min(1).max(50),
  referenceContent: z.string().optional().default(''),
  common: z.object({
    slug: z.string(),
    category: z.string().optional().nullable(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }),
  currentTranslations: z.array(
    z.object({
      locale: z.string(),
      name: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      content: z.string().optional().nullable(),
    })
  ),
  fillMissingOnly: z.boolean().default(true),
});

type AutofillCurrentTranslation = z.infer<
  typeof autofillTagTranslationsSchema
>['currentTranslations'][number];

async function buildTagReferenceContent({
  slug,
  category,
  currentTranslations,
}: {
  slug: string;
  category?: string | null;
  currentTranslations: AutofillCurrentTranslation[];
}) {
  const relatedTools = await db
    .select({
      name: tools.name,
      url: tools.url,
      tags: tools.tags,
      featured: tools.featured,
      description: toolTranslations.description,
      introduction: toolTranslations.introduction,
    })
    .from(tools)
    .leftJoin(
      toolTranslations,
      and(
        eq(toolTranslations.toolId, tools.id),
        eq(toolTranslations.locale, 'en')
      )
    )
    .where(
      and(
        eq(tools.published, true),
        sql`${tools.tags}::jsonb @> ${JSON.stringify([slug])}::jsonb`
      )
    )
    .orderBy(desc(tools.featured), desc(tools.createdAt))
    .limit(6);

  const existingTranslationSummary = currentTranslations
    .map((translation) => {
      const parts = [
        translation.name ? `name: ${translation.name}` : null,
        translation.description
          ? `description: ${translation.description}`
          : null,
        translation.content ? `content: ${translation.content}` : null,
      ].filter(Boolean);

      if (parts.length === 0) {
        return null;
      }

      return `- ${translation.locale}: ${parts.join(' | ')}`;
    })
    .filter(Boolean)
    .join('\n');

  const relatedTagCounts = new Map<string, number>();

  for (const tool of relatedTools) {
    const toolTagsValue = tool.tags ? (JSON.parse(tool.tags) as string[]) : [];

    for (const tagSlug of toolTagsValue) {
      if (tagSlug === slug) {
        continue;
      }

      relatedTagCounts.set(tagSlug, (relatedTagCounts.get(tagSlug) || 0) + 1);
    }
  }

  const relatedTagSummary = Array.from(relatedTagCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([tagSlug, count]) => `- ${tagSlug} (${count})`)
    .join('\n');

  const toolSummary = relatedTools
    .map((tool, index) => {
      const description = tool.description?.trim() || 'n/a';
      const introduction = tool.introduction?.trim() || 'n/a';
      return [
        `### Tool ${index + 1}: ${tool.name}`,
        `- URL: ${tool.url}`,
        `- Featured: ${tool.featured ? 'yes' : 'no'}`,
        `- Description: ${description}`,
        `- Introduction: ${introduction}`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    `Tag slug: ${slug}`,
    `Category: ${category || 'general'}`,
    '',
    'Existing translations:',
    existingTranslationSummary || '- none',
    '',
    'Representative tools in this tag:',
    toolSummary || '- none',
    '',
    'Frequently co-occurring tags:',
    relatedTagSummary || '- none',
  ]
    .join('\n')
    .trim();
}

// ============================================================================
// Actions
// ============================================================================

/**
 * 创建新标签（主表 + 两条翻译记录）
 */
export const createTagAction = actionClient
  .schema(createTagSchema)
  .action(async ({ parsedInput }) => {
    try {
      // 检查 slug 是否已存在
      const existing = await db.query.toolTags.findFirst({
        where: eq(toolTags.slug, parsedInput.slug),
      });

      if (existing) {
        return {
          success: false,
          error: `Tag with slug "${parsedInput.slug}" already exists`,
        };
      }

      // 使用事务确保原子性
      const result = await db.transaction(async (tx) => {
        // 1. 插入主表
        const [mainTag] = await tx
          .insert(toolTags)
          .values({
            id: nanoid(),
            slug: parsedInput.slug,
            category: parsedInput.category || null,
            status: parsedInput.status,
          })
          .returning();

        // 2. 插入英文翻译
        const [enTranslation] = await tx
          .insert(toolTagTranslations)
          .values({
            id: nanoid(),
            slug: parsedInput.slug,
            locale: 'en',
            name: parsedInput.enName,
            description: parsedInput.enDescription || null,
          })
          .returning();

        // 3. 插入中文翻译
        const [zhTranslation] = await tx
          .insert(toolTagTranslations)
          .values({
            id: nanoid(),
            slug: parsedInput.slug,
            locale: 'zh',
            name: parsedInput.zhName,
            description: parsedInput.zhDescription || null,
          })
          .returning();

        return { mainTag, enTranslation, zhTranslation };
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Create tag error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tag',
      };
    }
  });

/**
 * 更新标签（分别更新主表和翻译表）
 */
export const updateTagAction = actionClient
  .schema(updateTagSchema)
  .action(async ({ parsedInput }) => {
    try {
      const {
        slug,
        enName,
        zhName,
        enDescription,
        zhDescription,
        category,
        status,
      } = parsedInput;

      await db.transaction(async (tx) => {
        // 1. 更新主表（如果有主表字段需要更新）
        if (category !== undefined || status !== undefined) {
          await tx
            .update(toolTags)
            .set({
              ...(category !== undefined && { category }),
              ...(status !== undefined && { status }),
              updatedAt: new Date(),
            })
            .where(eq(toolTags.slug, slug));
        }

        // 2. 更新英文翻译
        if (enName !== undefined || enDescription !== undefined) {
          await tx
            .update(toolTagTranslations)
            .set({
              ...(enName !== undefined && { name: enName }),
              ...(enDescription !== undefined && {
                description: enDescription,
              }),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(toolTagTranslations.slug, slug),
                eq(toolTagTranslations.locale, 'en')
              )
            );
        }

        // 3. 更新中文翻译
        if (zhName !== undefined || zhDescription !== undefined) {
          await tx
            .update(toolTagTranslations)
            .set({
              ...(zhName !== undefined && { name: zhName }),
              ...(zhDescription !== undefined && {
                description: zhDescription,
              }),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(toolTagTranslations.slug, slug),
                eq(toolTagTranslations.locale, 'zh')
              )
            );
        }
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Update tag error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update tag',
      };
    }
  });

/**
 * 删除标签（CASCADE 会自动删除翻译记录）
 */
export const deleteTagAction = actionClient
  .schema(z.object({ slug: z.string() }))
  .action(async ({ parsedInput }) => {
    try {
      const { slug } = parsedInput;

      await db.transaction(async (tx) => {
        // 1. 从所有工具的 tags JSON 字段中移除该标签 slug（使用 JSONB 操作符精确匹配）
        await tx.execute(sql`
          UPDATE tools
          SET tags = (
            SELECT json_agg(tag)
            FROM json_array_elements_text(tags::json) AS tag
            WHERE tag != ${slug}
          )::text
          WHERE tags::jsonb @> jsonb_build_array(${slug})
        `);

        // 2. 删除主表记录（CASCADE 会自动删除翻译记录）
        await tx.delete(toolTags).where(eq(toolTags.slug, slug));
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Delete tag error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete tag',
      };
    }
  });

/**
 * 获取所有标签（指定语言）- 使用 JOIN
 */
export const getAllTagsAction = actionClient
  .schema(z.object({ locale: z.string().default('en') }))
  .action(async ({ parsedInput }) => {
    try {
      const tags = await db
        .select({
          id: toolTags.id,
          slug: toolTags.slug,
          category: toolTags.category,
          status: toolTags.status,
          sortOrder: toolTags.sortOrder,
          usageCount: toolTags.usageCount,
          createdAt: toolTags.createdAt,
          updatedAt: toolTags.updatedAt,
          name: toolTagTranslations.name,
          description: toolTagTranslations.description,
        })
        .from(toolTags)
        .innerJoin(
          toolTagTranslations,
          eq(toolTags.slug, toolTagTranslations.slug)
        )
        .where(eq(toolTagTranslations.locale, parsedInput.locale))
        .orderBy(desc(toolTags.usageCount), desc(toolTags.createdAt));

      return {
        success: true,
        data: tags,
      };
    } catch (error) {
      console.error('Get all tags error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tags',
        data: [],
      };
    }
  });

/**
 * 获取所有标签（所有语言，按 slug 分组）
 * 用于管理后台展示
 */
export const getAllTagsGroupedAction = actionClient
  .schema(z.object({}))
  .action(async () => {
    try {
      // 查询所有标签及其翻译
      const allTags = await db
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
          // 翻译字段
          translationId: toolTagTranslations.id,
          locale: toolTagTranslations.locale,
          name: toolTagTranslations.name,
          description: toolTagTranslations.description,
          content: toolTagTranslations.content,
        })
        .from(toolTags)
        .leftJoin(
          toolTagTranslations,
          eq(toolTags.slug, toolTagTranslations.slug)
        )
        .orderBy(desc(toolTags.usageCount), desc(toolTags.createdAt));

      // 按 slug 分组
      const groupedMap = new Map<
        string,
        {
          slug: string;
          category: string | null;
          status: string | null;
          sortOrder: number;
          usageCount: number;
          createdAt: Date;
          updatedAt: Date;
          translations: {
            locale: string | null;
            id: string | null;
            name: string | null;
            description: string | null;
            content: string | null;
          }[];
        }
      >();

      for (const tag of allTags) {
        if (!groupedMap.has(tag.slug)) {
          groupedMap.set(tag.slug, {
            slug: tag.slug,
            category: tag.category,
            status: tag.status,
            sortOrder: tag.sortOrder,
            usageCount: tag.usageCount,
            createdAt: tag.createdAt,
            updatedAt: tag.updatedAt,
            translations: [],
          });
        }

        const group = groupedMap.get(tag.slug)!;
        if (tag.locale) {
          group.translations.push({
            locale: tag.locale,
            id: tag.translationId,
            name: tag.name,
            description: tag.description,
            content: tag.content,
          });
        }
      }

      // 转换为数组
      const grouped = Array.from(groupedMap.values());

      return {
        success: true,
        data: grouped,
      };
    } catch (error) {
      console.error('Get all tags grouped error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tags',
        data: [],
      };
    }
  });

/**
 * 获取已发布的标签（指定语言）
 */
export const getPublishedTagsAction = actionClient
  .schema(z.object({ locale: z.string().default('en') }))
  .action(async ({ parsedInput }) => {
    try {
      const tags = await db
        .select({
          id: toolTags.id,
          slug: toolTags.slug,
          category: toolTags.category,
          status: toolTags.status,
          sortOrder: toolTags.sortOrder,
          usageCount: toolTags.usageCount,
          createdAt: toolTags.createdAt,
          updatedAt: toolTags.updatedAt,
          name: toolTagTranslations.name,
          description: toolTagTranslations.description,
        })
        .from(toolTags)
        .innerJoin(
          toolTagTranslations,
          eq(toolTags.slug, toolTagTranslations.slug)
        )
        .where(
          and(
            eq(toolTagTranslations.locale, parsedInput.locale),
            eq(toolTags.status, 'published')
          )
        )
        .orderBy(desc(toolTags.usageCount), desc(toolTags.createdAt));

      return {
        success: true,
        data: tags,
      };
    } catch (error) {
      console.error('Get published tags error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tags',
        data: [],
      };
    }
  });

/**
 * 为工具关联标签
 * 直接更新 tools.tags JSON 字段
 */
export const linkToolToTagsAction = actionClient
  .schema(linkToolToTagsSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { toolId, tagSlugs } = parsedInput;

      // 验证标签是否存在（只需查询主表）
      if (tagSlugs.length > 0) {
        const tags = await db.query.toolTags.findMany({
          where: inArray(toolTags.slug, tagSlugs),
        });

        if (tags.length !== tagSlugs.length) {
          return {
            success: false,
            error: 'Some tags not found',
          };
        }
      }

      // 更新工具的 tags JSON 字段
      await db
        .update(tools)
        .set({
          tags: JSON.stringify(tagSlugs),
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      // 更新标签的使用次数（使用 JSONB 操作符精确匹配）
      await db.execute(sql`
        UPDATE tool_tags
        SET usage_count = (
          SELECT COUNT(*)
          FROM tools
          WHERE tags::jsonb @> jsonb_build_array(tool_tags.slug)
        ),
        updated_at = NOW()
      `);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Link tool to tags error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to link tool to tags',
      };
    }
  });

/**
 * 获取工具的标签（指定语言）
 * 从 tools.tags JSON 字段读取
 */
export const getToolTagsAction = actionClient
  .schema(z.object({ toolId: z.string(), locale: z.string().default('en') }))
  .action(async ({ parsedInput }) => {
    try {
      // 获取工具的 tags JSON 字段
      const tool = await db.query.tools.findFirst({
        where: eq(tools.id, parsedInput.toolId),
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

      // 查询标签详情（指定语言）- 使用 JOIN
      const tags = await db
        .select({
          id: toolTags.id,
          slug: toolTags.slug,
          category: toolTags.category,
          status: toolTags.status,
          sortOrder: toolTags.sortOrder,
          usageCount: toolTags.usageCount,
          createdAt: toolTags.createdAt,
          updatedAt: toolTags.updatedAt,
          name: toolTagTranslations.name,
          description: toolTagTranslations.description,
        })
        .from(toolTags)
        .innerJoin(
          toolTagTranslations,
          eq(toolTags.slug, toolTagTranslations.slug)
        )
        .where(
          and(
            inArray(toolTags.slug, tagSlugs),
            eq(toolTagTranslations.locale, parsedInput.locale)
          )
        );

      return {
        success: true,
        data: tags,
      };
    } catch (error) {
      console.error('Get tool tags error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get tool tags',
        data: [],
      };
    }
  });

/**
 * 批量导入标签（从现有 JSON 字段迁移，同时创建英文和中文版本）
 */
export const batchImportTagsAction = actionClient
  .schema(z.object({ tags: z.array(z.string()) }))
  .action(async ({ parsedInput }) => {
    try {
      const { tags: tagNames } = parsedInput;
      const created = [];
      const skipped = [];

      for (const tagName of tagNames) {
        const slug = tagName.toLowerCase().replace(/\s+/g, '-');

        // 检查是否已存在
        const existing = await db.query.toolTags.findFirst({
          where: eq(toolTags.slug, slug),
        });

        if (existing) {
          skipped.push(tagName);
          continue;
        }

        // 使用事务创建标签
        const result = await db.transaction(async (tx) => {
          // 插入主表
          const [mainTag] = await tx
            .insert(toolTags)
            .values({
              id: nanoid(),
              slug,
              category: null,
              status: 'published',
            })
            .returning();

          // 插入英文翻译
          const [enTranslation] = await tx
            .insert(toolTagTranslations)
            .values({
              id: nanoid(),
              slug,
              locale: 'en',
              name: tagName,
              description: null,
            })
            .returning();

          // 插入中文翻译（可以后续手动翻译）
          const [zhTranslation] = await tx
            .insert(toolTagTranslations)
            .values({
              id: nanoid(),
              slug,
              locale: 'zh',
              name: tagName,
              description: null,
            })
            .returning();

          return { mainTag, enTranslation, zhTranslation };
        });

        created.push(result);
      }

      return {
        success: true,
        data: {
          created,
          skipped,
        },
      };
    } catch (error) {
      console.error('Batch import tags error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import tags',
      };
    }
  });

/**
 * 批量更新标签（主表 + 多语言翻译）
 * 单事务更新主表和所有语言翻译
 */
export const updateTagBatchAction = actionClient
  .schema(updateTagBatchSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { slug, common, translations } = parsedInput;

      await db.transaction(async (tx) => {
        // 1. 更新主表（如果有公共字段需要更新）
        if (
          common &&
          (common.category !== undefined || common.status !== undefined)
        ) {
          await tx
            .update(toolTags)
            .set({
              ...(common.category !== undefined && {
                category: common.category,
              }),
              ...(common.status !== undefined && { status: common.status }),
              updatedAt: new Date(),
            })
            .where(eq(toolTags.slug, slug));
        }

        // 2. 批量更新/插入翻译
        for (const trans of translations) {
          if (!trans.name && !trans.description && !trans.content) {
            continue; // 跳过空翻译
          }

          // 检查翻译是否存在
          const existing = await tx.query.toolTagTranslations.findFirst({
            where: and(
              eq(toolTagTranslations.slug, slug),
              eq(toolTagTranslations.locale, trans.locale)
            ),
          });

          if (existing) {
            // 更新现有翻译
            await tx
              .update(toolTagTranslations)
              .set({
                ...(trans.name !== undefined && { name: trans.name }),
                ...(trans.description !== undefined && {
                  description: trans.description,
                }),
                ...(trans.content !== undefined && { content: trans.content }),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(toolTagTranslations.slug, slug),
                  eq(toolTagTranslations.locale, trans.locale)
                )
              );
          } else {
            // 插入新翻译
            await tx.insert(toolTagTranslations).values({
              id: nanoid(),
              slug,
              locale: trans.locale,
              name: trans.name || '',
              description: trans.description || null,
              content: trans.content || null,
            });
          }
        }
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('Update tag batch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update tag',
      };
    }
  });

/**
 * 自动补全标签的多语言翻译（仅填充缺失字段）
 * 使用 AI 根据参考内容生成所有语言的翻译
 */
export const autofillTagTranslationsAction = actionClient
  .schema(autofillTagTranslationsSchema)
  .action(async ({ parsedInput }) => {
    try {
      const {
        slug,
        referenceContent,
        common,
        currentTranslations,
        fillMissingOnly,
      } = parsedInput;

      // 获取全站支持的语言列表
      const locales = Object.keys(websiteConfig.i18n.locales);

      const resolvedReferenceContent =
        referenceContent.trim().length >= 10
          ? referenceContent.trim()
          : await buildTagReferenceContent({
              slug,
              category: common.category,
              currentTranslations,
            });

      if (resolvedReferenceContent.trim().length < 10) {
        return {
          success: false,
          error: '未能生成足够的参考内容，请先补充参考资料后再试',
        };
      }

      // 清理参考内容
      const safeReferenceContent = sanitizeForPrompt(
        resolvedReferenceContent,
        5000
      );
      const safeSlug = sanitizeForPrompt(slug, 50);
      const safeCategory = common.category
        ? sanitizeForPrompt(common.category, 50)
        : 'general';

      // 构建当前翻译映射
      const currentMap = new Map(currentTranslations.map((t) => [t.locale, t]));

      // 构建 AI 提示词
      const prompt = `You are a professional translator for a tool directory website. Generate tag translations for all supported languages.

Tag Information:
- Slug: ${safeSlug}
- Category: ${safeCategory}
- Reference Content: ${safeReferenceContent}

Supported Languages: ${locales.join(', ')}

Current Translations (DO NOT overwrite non-empty fields):
${currentTranslations
  .map(
    (t) =>
      `- ${t.locale}: name="${t.name || ''}", description="${t.description || ''}", content="${t.content || ''}"`
  )
  .join('\n')}

Requirements:
1. Generate translations for ALL languages: ${locales.join(', ')}
2. For each language, provide:
   - name: Short tag name (2-5 words)
   - description: Brief description (10-30 words)
   - content: Detailed explanation in Markdown format (50-200 words)
3. ${fillMissingOnly ? 'ONLY fill in EMPTY fields. DO NOT overwrite existing non-empty values.' : 'Generate all fields for all languages.'}
4. Keep the tone professional and consistent across languages
5. Use native language conventions for each locale

Return ONLY a JSON object in this exact format:
{
  "translations": [
    {
      "locale": "en",
      "name": "AI Tool",
      "description": "Tools powered by artificial intelligence",
      "content": "## What are AI Tools?\\n\\nAI tools are..."
    },
    {
      "locale": "zh",
      "name": "AI 工具",
      "description": "由人工智能驱动的工具",
      "content": "## 什么是 AI 工具？\\n\\nAI 工具是..."
    }
  ]
}`;

      // 调用 AI API
      const apiResult = await callEvolinkAPIWithRetry({
        prompt,
        temperature: 0.7,
        maxTokens: 8000,
      });

      if (!apiResult.success) {
        return { success: false, error: apiResult.error };
      }

      // 解析 AI 响应
      const parseResult = parseAIJsonResponse<{
        translations: Array<{
          locale: string;
          name?: string;
          description?: string;
          content?: string;
        }>;
      }>(apiResult.content);

      if (!parseResult.success || !parseResult.data) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse AI response',
        };
      }

      const aiTranslations = parseResult.data.translations || [];

      // 合并翻译：仅填充缺失字段
      const mergedTranslations: Array<{
        locale: string;
        name?: string;
        description?: string | null;
        content?: string | null;
      }> = [];

      const filledLocales: string[] = [];

      for (const locale of locales) {
        const current = currentMap.get(locale);
        const ai = aiTranslations.find((t) => t.locale === locale);

        const merged: {
          locale: string;
          name?: string;
          description?: string | null;
          content?: string | null;
        } = { locale };

        let hasFilled = false;

        // 仅在字段为空时填充
        if (!current?.name && ai?.name) {
          merged.name = ai.name;
          hasFilled = true;
        } else if (current?.name) {
          merged.name = current.name;
        }

        if (!current?.description && ai?.description) {
          merged.description = ai.description;
          hasFilled = true;
        } else if (current?.description) {
          merged.description = current.description;
        }

        if (!current?.content && ai?.content) {
          merged.content = ai.content;
          hasFilled = true;
        } else if (current?.content) {
          merged.content = current.content;
        }

        if (hasFilled) {
          filledLocales.push(locale);
        }

        mergedTranslations.push(merged);
      }

      return {
        success: true,
        data: {
          mergedTranslations,
          filledLocales,
          referenceContent: resolvedReferenceContent,
          summary: `已为 ${filledLocales.length} 个语言补全缺失字段: ${filledLocales.join(', ')}`,
        },
      };
    } catch (error) {
      console.error('Autofill tag translations error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to autofill translations',
      };
    }
  });
