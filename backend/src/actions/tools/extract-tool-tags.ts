'use server';

import { db } from '@/db';
import { toolTagTranslations, toolTags, tools } from '@/db/schema';
import { TAG_WHITELIST, MAX_TAGS_PER_TOOL, MIN_TAGS_PER_TOOL } from '@/config/tag-whitelist';
import { actionClient } from '@/lib/safe-action';
import Anthropic from '@anthropic-ai/sdk';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// Schema
// ============================================================================

const extractToolTagsSchema = z.object({
  toolId: z.string().min(1, 'Tool ID is required'),
  autoTranslate: z.boolean().default(true),
});

// ============================================================================
// Types
// ============================================================================

interface ExtractedTag {
  slug: string;
  enName: string;
  zhName: string;
  enDescription?: string;
  zhDescription?: string;
  category?: string;
  iconEmoji?: string;
  confidence?: number; // 置信度分数 (0-1)
}

// ============================================================================
// Actions
// ============================================================================

/**
 * 使用 AI 从工具信息中提取标签
 * 自动生成英文和中文名称
 */
export const extractToolTagsAction = actionClient
  .schema(extractToolTagsSchema)
  .action(async ({ parsedInput: { toolId, autoTranslate } }) => {
    try {
      // 1. 获取工具信息
      const tool = await db.query.tools.findFirst({
        where: eq(tools.id, toolId),
        with: {
          translations: true,
        },
      });

      if (!tool) {
        return {
          success: false,
          error: 'Tool not found',
        };
      }

      // 2. 准备工具信息用于 AI 分析
      const toolInfo = {
        name: tool.name,
        url: tool.url,
        translations: tool.translations,
      };

      // 3. 使用 AI 提取标签（注入白名单）
      const prompt = `你是一个专业的工具分类专家。请根据以下工具信息，从标签白名单中选择 ${MIN_TAGS_PER_TOOL}-${MAX_TAGS_PER_TOOL} 个最相关的标签。

工具信息：
- 名称: ${toolInfo.name}
- URL: ${toolInfo.url}
- 描述: ${toolInfo.translations.map((t) => `${t.locale}: ${t.description}`).join('\n')}

标签白名单（按 category 分组）：
${JSON.stringify(TAG_WHITELIST, null, 2)}

要求：
1. **必须从白名单中选择标签**（不能创建新标签）
2. **标签数量**: ${MIN_TAGS_PER_TOOL}-${MAX_TAGS_PER_TOOL} 个
3. **标签优先级排序**（非常重要）：
   - 第 1-2 个：type（工具类型，如 ai-image-generator, design-tool）
   - 第 3 个：pricing（定价模式，如 freemium, paid）
   - 第 4-5 个：platform（平台类型，如 web-app, api）
   - 第 6-${MAX_TAGS_PER_TOOL} 个：feature（核心功能，如 text-to-image, background-removal）
   - 可选：general（通用标签，如 productivity, creativity）
4. **每个标签附带置信度分数**（0-1，表示该标签与工具的相关程度）
5. **标签必须准确反映工具的核心功能**，避免过于宽泛或不相关的标签

返回 JSON 格式：
{
  "tags": [
    {
      "slug": "ai-image-generator",
      "enName": "AI Image Generator",
      "zhName": "AI 图像生成器",
      "enDescription": "Generate images using AI",
      "zhDescription": "使用 AI 生成图像",
      "category": "type",
      "confidence": 0.95
    },
    {
      "slug": "freemium",
      "enName": "Freemium",
      "zhName": "免费增值",
      "category": "pricing",
      "confidence": 0.90
    }
  ]
}

注意：
- slug 必须完全匹配白名单中的值（小写，用连字符分隔）
- 按优先级顺序返回标签（type > pricing > platform > feature > general）
- 置信度高的标签排在前面
- 如果工具信息不足以确定某个 category 的标签，可以跳过该 category`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // 4. 解析 AI 响应
      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from AI response');
      }

      const result = JSON.parse(jsonMatch[0]) as { tags: ExtractedTag[] };
      let extractedTags = result.tags;

      // 验证标签是否在白名单中，过滤掉不在白名单中的标签
      const allWhitelistTags = [
        ...TAG_WHITELIST.type,
        ...TAG_WHITELIST.pricing,
        ...TAG_WHITELIST.platform,
        ...TAG_WHITELIST.feature,
        ...TAG_WHITELIST.general,
      ];

      extractedTags = extractedTags.filter((tag) => {
        if (!allWhitelistTags.includes(tag.slug)) {
          console.warn(`Tag "${tag.slug}" is not in whitelist, skipping...`);
          return false;
        }
        return true;
      });

      // 按置信度排序（保持 AI 返回的优先级顺序）
      extractedTags.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      // 限制标签数量
      if (extractedTags.length > MAX_TAGS_PER_TOOL) {
        extractedTags = extractedTags.slice(0, MAX_TAGS_PER_TOOL);
      }

      if (extractedTags.length < MIN_TAGS_PER_TOOL) {
        console.warn(
          `Only ${extractedTags.length} tags extracted, less than minimum ${MIN_TAGS_PER_TOOL}`,
        );
      }

      // 5. 创建或更新标签，并确保同步到 tool_tags 表
      const tagSlugs: string[] = [];

      for (const tag of extractedTags) {
        // 检查标签是否已存在（只需查询主表）
        const existingTag = await db.query.toolTags.findFirst({
          where: eq(toolTags.slug, tag.slug),
          with: {
            translations: true,
          },
        });

        if (existingTag) {
          // 标签已存在，检查是否需要补充翻译
          const hasEnTranslation = existingTag.translations?.some((t) => t.locale === 'en');
          const hasZhTranslation = existingTag.translations?.some((t) => t.locale === 'zh');

          // 如果缺少翻译，补充翻译
          if (!hasEnTranslation && tag.enName) {
            await db.insert(toolTagTranslations).values({
              id: nanoid(),
              slug: tag.slug,
              locale: 'en',
              name: tag.enName,
              description: tag.enDescription || null,
            });
            console.log(`✓ 补充英文翻译: ${tag.slug}`);
          }

          if (!hasZhTranslation && tag.zhName) {
            await db.insert(toolTagTranslations).values({
              id: nanoid(),
              slug: tag.slug,
              locale: 'zh',
              name: tag.zhName,
              description: tag.zhDescription || null,
            });
            console.log(`✓ 补充中文翻译: ${tag.slug}`);
          }

          tagSlugs.push(existingTag.slug);
        } else {
          // 创建新标签（使用事务确保数据一致性）
          await db.transaction(async (tx) => {
            // 1. 插入主表（初始状态为 draft，等待翻译补全）
            await tx.insert(toolTags).values({
              id: nanoid(),
              slug: tag.slug,
              category: tag.category || 'general',
              status: 'draft', // 初始状态为 draft
              sortOrder: 0,
              usageCount: 0,
            });

            // 2. 插入英文翻译
            if (tag.enName) {
              await tx.insert(toolTagTranslations).values({
                id: nanoid(),
                slug: tag.slug,
                locale: 'en',
                name: tag.enName,
                description: tag.enDescription || null,
              });
            }

            // 3. 插入中文翻译
            if (tag.zhName) {
              await tx.insert(toolTagTranslations).values({
                id: nanoid(),
                slug: tag.slug,
                locale: 'zh',
                name: tag.zhName,
                description: tag.zhDescription || null,
              });
            }
          });

          console.log(`✓ 创建新标签: ${tag.slug} (${tag.enName} / ${tag.zhName})`);
          tagSlugs.push(tag.slug);
        }
      }

      // 6. 更新工具的 tags JSON 字段
      await db
        .update(tools)
        .set({
          tags: JSON.stringify(tagSlugs),
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolId));

      // 7. 更新标签的使用次数（使用 JSONB 操作符精确匹配）
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
        data: {
          toolId,
          extractedTags,
          tagCount: tagSlugs.length,
        },
      };
    } catch (error) {
      console.error('Error extracting tool tags:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to extract tool tags',
      };
    }
  });
