'use server';

import { db, getExecuteRows } from '@/db';
import { toolTagTranslations, toolTags } from '@/db/schema';
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

const completeTagTranslationsSchema = z.object({
  slug: z.string().min(1, 'Tag slug is required'),
  autoGenerate: z.boolean().default(true), // 是否使用 AI 自动生成翻译
});

// ============================================================================
// Types
// ============================================================================

interface TranslationData {
  enName: string;
  zhName: string;
  enDescription?: string;
  zhDescription?: string;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * 补全标签翻译
 *
 * 功能：
 * 1. 检查标签的翻译完整性
 * 2. 如果缺少英文或中文翻译，使用 AI 自动生成
 * 3. 更新标签状态（如果翻译完整且工具数达标）
 */
export const completeTagTranslationsAction = actionClient
  .schema(completeTagTranslationsSchema)
  .action(async ({ parsedInput: { slug, autoGenerate } }) => {
    try {
      // 1. 获取标签信息和现有翻译
      const tag = await db.query.toolTags.findFirst({
        where: eq(toolTags.slug, slug),
        with: {
          translations: true,
        },
      });

      if (!tag) {
        return {
          success: false,
          error: 'Tag not found',
        };
      }

      // 2. 检查翻译完整性
      const hasEnTranslation = tag.translations?.some((t) => t.locale === 'en');
      const hasZhTranslation = tag.translations?.some((t) => t.locale === 'zh');

      if (hasEnTranslation && hasZhTranslation) {
        return {
          success: true,
          message: 'Tag translations are already complete',
          data: {
            slug,
            hasEnTranslation: true,
            hasZhTranslation: true,
          },
        };
      }

      // 3. 如果需要自动生成翻译
      if (autoGenerate) {
        // 获取现有翻译作为参考
        const existingEn = tag.translations?.find((t) => t.locale === 'en');
        const existingZh = tag.translations?.find((t) => t.locale === 'zh');

        // 使用 AI 生成缺失的翻译
        const prompt = `你是一个专业的翻译专家。请为以下标签生成缺失的翻译。

标签信息：
- Slug: ${slug}
- Category: ${tag.category}
${existingEn ? `- 现有英文名称: ${existingEn.name}` : ''}
${existingEn?.description ? `- 现有英文描述: ${existingEn.description}` : ''}
${existingZh ? `- 现有中文名称: ${existingZh.name}` : ''}
${existingZh?.description ? `- 现有中文描述: ${existingZh.description}` : ''}

请生成：
${!hasEnTranslation ? '- 英文名称（enName）和描述（enDescription）' : ''}
${!hasZhTranslation ? '- 中文名称（zhName）和描述（zhDescription）' : ''}

要求：
1. 名称简洁明了，符合标签命名规范
2. 描述清晰准确，说明该标签的含义和用途
3. 英文和中文翻译要对应准确
4. 如果已有一种语言的翻译，请基于它生成另一种语言的翻译

返回 JSON 格式：
{
  "enName": "AI Image Generator",
  "zhName": "AI 图像生成器",
  "enDescription": "Tools that generate images using artificial intelligence",
  "zhDescription": "使用人工智能生成图像的工具"
}`;

        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        // 解析 AI 响应
        const content = message.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from AI');
        }

        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Failed to extract JSON from AI response');
        }

        const translationData = JSON.parse(jsonMatch[0]) as TranslationData;

        // 4. 插入缺失的翻译
        if (!hasEnTranslation && translationData.enName) {
          await db.insert(toolTagTranslations).values({
            id: nanoid(),
            slug,
            locale: 'en',
            name: translationData.enName,
            description: translationData.enDescription || null,
          });
          console.log(`✓ 添加英文翻译: ${translationData.enName}`);
        }

        if (!hasZhTranslation && translationData.zhName) {
          await db.insert(toolTagTranslations).values({
            id: nanoid(),
            slug,
            locale: 'zh',
            name: translationData.zhName,
            description: translationData.zhDescription || null,
          });
          console.log(`✓ 添加中文翻译: ${translationData.zhName}`);
        }

        // 5. 更新标签状态（如果翻译完整且工具数达标）
        await db.execute(sql`
          UPDATE tool_tags
          SET status = CASE
            WHEN (
              SELECT COUNT(DISTINCT locale)
              FROM tool_tag_translations
              WHERE slug = ${slug} AND locale IN ('en', 'zh')
            ) = 2
            AND usage_count >= 5
            THEN 'published'
            ELSE 'draft'
          END,
          updated_at = NOW()
          WHERE slug = ${slug}
        `);

        revalidatePath('/admin/tags');
        revalidatePath('/tags');

        return {
          success: true,
          message: 'Tag translations completed successfully',
          data: {
            slug,
            hasEnTranslation: true,
            hasZhTranslation: true,
            generatedTranslations: translationData,
          },
        };
      } else {
        // 不自动生成，只返回当前状态
        return {
          success: false,
          error:
            'Tag translations are incomplete and auto-generate is disabled',
          data: {
            slug,
            hasEnTranslation,
            hasZhTranslation,
          },
        };
      }
    } catch (error) {
      console.error('Error completing tag translations:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to complete tag translations',
      };
    }
  });

/**
 * 批量补全所有缺失翻译的标签
 */
export const batchCompleteTagTranslationsAction = actionClient
  .schema(
    z.object({
      limit: z.number().min(1).max(100).default(50),
    })
  )
  .action(async ({ parsedInput: { limit } }) => {
    try {
      // 1. 获取所有缺少翻译的标签
      const tagsResult = await db.execute(sql`
        WITH tag_translation_status AS (
          SELECT
            tt.slug,
            tt.usage_count,
            COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
            COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
          FROM tool_tags tt
          LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
          GROUP BY tt.slug, tt.usage_count
        )
        SELECT slug
        FROM tag_translation_status
        WHERE has_en = 0 OR has_zh = 0
        ORDER BY usage_count DESC
        LIMIT ${limit}
      `);

      const tags = getExecuteRows(
        tagsResult as unknown as
          | Array<{ slug: string }>
          | { rows: Array<{ slug: string }> }
      );

      if (tags.length === 0) {
        return {
          success: true,
          message: 'No tags need translation completion',
          data: {
            totalCount: 0,
            successCount: 0,
            failedCount: 0,
          },
        };
      }

      // 2. 批量补全翻译
      let successCount = 0;
      let failedCount = 0;
      const failedTags: Array<{ slug: string; error: string }> = [];

      for (const tag of tags) {
        try {
          const result = await completeTagTranslationsAction({
            slug: tag.slug,
            autoGenerate: true,
          });

          if (result?.data?.success) {
            successCount++;
            console.log(`✓ ${tag.slug} 翻译补全成功`);
          } else {
            failedCount++;
            failedTags.push({
              slug: tag.slug,
              error: result?.data?.error || 'Unknown error',
            });
            console.log(`✗ ${tag.slug} 翻译补全失败`);
          }
        } catch (error) {
          failedCount++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          failedTags.push({
            slug: tag.slug,
            error: errorMessage,
          });
          console.log(`✗ ${tag.slug} 翻译补全失败: ${errorMessage}`);
        }

        // 延迟避免 API 限流
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return {
        success: true,
        message: `Batch translation completion finished: ${successCount} succeeded, ${failedCount} failed`,
        data: {
          totalCount: tags.length,
          successCount,
          failedCount,
          failedTags,
        },
      };
    } catch (error) {
      console.error('Error in batch translation completion:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to batch complete translations',
      };
    }
  });
