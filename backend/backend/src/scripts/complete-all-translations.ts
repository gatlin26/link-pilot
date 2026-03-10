/**
 * 批量补全所有缺失的标签翻译
 *
 * 使用方法：
 * pnpm tsx src/scripts/complete-all-translations.ts [--limit 数量]
 *
 * 示例：
 * pnpm tsx src/scripts/complete-all-translations.ts --limit 50
 */

import '../lib/env-loader';
import { db } from '../db/index';
import { sql, eq } from 'drizzle-orm';
import { toolTags, toolTagTranslations } from '../db/schema';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface CompleteOptions {
  limit?: number;
  delayMs?: number;
}

interface TranslationData {
  enName: string;
  zhName: string;
  enDescription?: string;
  zhDescription?: string;
}

/**
 * 为单个标签补全翻译
 */
async function completeTagTranslation(slug: string): Promise<{
  success: boolean;
  error?: string;
}> {
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
      };
    }

    // 3. 获取现有翻译作为参考
    const existingEn = tag.translations?.find((t) => t.locale === 'en');
    const existingZh = tag.translations?.find((t) => t.locale === 'zh');

    // 4. 使用 AI 生成缺失的翻译
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

    // 5. 解析 AI 响应
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    const translationData = JSON.parse(jsonMatch[0]) as TranslationData;

    // 6. 插入缺失的翻译
    if (!hasEnTranslation && translationData.enName) {
      await db.insert(toolTagTranslations).values({
        id: nanoid(),
        slug,
        locale: 'en',
        name: translationData.enName,
        description: translationData.enDescription || null,
      });
    }

    if (!hasZhTranslation && translationData.zhName) {
      await db.insert(toolTagTranslations).values({
        id: nanoid(),
        slug,
        locale: 'zh',
        name: translationData.zhName,
        description: translationData.zhDescription || null,
      });
    }

    // 7. 更新标签状态（如果翻译完整且工具数达标）
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

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function completeAllTranslations(options: CompleteOptions = {}) {
  const { limit = 100, delayMs = 1500 } = options;

  console.log('=== 批量补全标签翻译 ===\n');
  console.log(`配置:`);
  console.log(`  - 限制数量: ${limit}`);
  console.log(`  - 延迟时间: ${delayMs}ms`);
  console.log('');

  try {
    // 1. 获取所有缺少翻译的标签
    console.log('步骤 1: 查询缺少翻译的标签...');
    const tagsResult = await db.execute(sql`
      WITH tag_translation_status AS (
        SELECT
          tt.slug,
          tt.usage_count,
          tt.category,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
        FROM tool_tags tt
        LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
        GROUP BY tt.slug, tt.usage_count, tt.category
      )
      SELECT
        slug,
        usage_count,
        category,
        CASE
          WHEN has_en = 0 AND has_zh = 0 THEN 'both'
          WHEN has_en = 0 THEN 'en'
          WHEN has_zh = 0 THEN 'zh'
        END as missing_locale
      FROM tag_translation_status
      WHERE has_en = 0 OR has_zh = 0
      ORDER BY usage_count DESC
      LIMIT ${limit}
    `);

    const tags = (tagsResult.rows || []) as Array<{
      slug: string;
      usage_count: number;
      category: string;
      missing_locale: string;
    }>;

    console.log(`✓ 找到 ${tags.length} 个缺少翻译的标签\n`);

    if (tags.length === 0) {
      console.log('所有标签的翻译都已完整！');
      return {
        success: true,
        totalCount: 0,
        successCount: 0,
        failedCount: 0,
      };
    }

    // 2. 显示待处理的标签
    console.log('待处理的标签（前 10 个）:');
    tags.slice(0, 10).forEach((tag, index) => {
      console.log(
        `  ${index + 1}. ${tag.slug} (${tag.category}) - ${tag.usage_count} 次使用 - 缺少: ${tag.missing_locale}`,
      );
    });
    if (tags.length > 10) {
      console.log(`  ... 还有 ${tags.length - 10} 个标签`);
    }
    console.log('');

    // 3. 批量补全翻译
    console.log('步骤 2: 开始补全翻译...\n');
    let successCount = 0;
    let failedCount = 0;
    const failedTags: Array<{ slug: string; error: string }> = [];

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const progress = `[${i + 1}/${tags.length}]`;

      console.log(`${progress} 处理标签: ${tag.slug} (缺少: ${tag.missing_locale})`);

      try {
        const result = await completeTagTranslation(tag.slug);

        if (result.success) {
          successCount++;
          console.log(`  ✓ 翻译补全成功\n`);
        } else {
          failedCount++;
          const error = result.error || 'Unknown error';
          failedTags.push({ slug: tag.slug, error });
          console.log(`  ✗ 翻译补全失败: ${error}\n`);
        }
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        failedTags.push({ slug: tag.slug, error: errorMessage });
        console.log(`  ✗ 翻译补全失败: ${errorMessage}\n`);
      }

      // 延迟避免 API 限流
      if (i < tags.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    // 4. 输出统计信息
    console.log('\n=== 处理完成 ===\n');
    console.log(`📊 统计信息:`);
    console.log(`  - 总数: ${tags.length}`);
    console.log(`  - 成功: ${successCount}`);
    console.log(`  - 失败: ${failedCount}`);
    console.log('');

    if (failedTags.length > 0) {
      console.log('❌ 失败的标签:');
      failedTags.forEach((tag) => {
        console.log(`  - ${tag.slug}: ${tag.error}`);
      });
      console.log('');
    }

    // 5. 建议下一步操作
    if (successCount > 0) {
      console.log('✅ 建议下一步操作:');
      console.log('  1. 运行标签状态更新脚本:');
      console.log('     pnpm tsx src/lib/cron/update-tag-status.ts');
      console.log('');
      console.log('  2. 检查标签状态是否正确更新:');
      console.log('     pnpm tsx src/scripts/analyze-tags.ts');
      console.log('');
    }

    return {
      success: true,
      totalCount: tags.length,
      successCount,
      failedCount,
      failedTags,
    };
  } catch (error) {
    console.error('❌ 批量补全翻译失败:', error);
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 如果直接运行此脚本
if (require.main === module) {
  // 从命令行参数读取配置
  const args = process.argv.slice(2);
  const options: CompleteOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--delay' && args[i + 1]) {
      options.delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log('使用方法:');
  console.log('  pnpm tsx src/scripts/complete-all-translations.ts [选项]');
  console.log('');
  console.log('选项:');
  console.log('  --limit <数量>    限制处理的标签数量（默认 100）');
  console.log('  --delay <毫秒>    每个标签之间的延迟（默认 1500ms）');
  console.log('');
  console.log('示例:');
  console.log('  pnpm tsx src/scripts/complete-all-translations.ts --limit 50');
  console.log('  pnpm tsx src/scripts/complete-all-translations.ts --limit 100 --delay 2000');
  console.log('');

  completeAllTranslations(options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
