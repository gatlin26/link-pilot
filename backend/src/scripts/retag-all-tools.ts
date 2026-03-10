import '../lib/env-loader';
import { db } from '../db/index';
import { tools, toolTags, toolTagTranslations, toolTranslations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { TAG_WHITELIST, MAX_TAGS_PER_TOOL, MIN_TAGS_PER_TOOL } from '@/config/tag-whitelist';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ExtractedTag {
	slug: string;
	enName: string;
	zhName: string;
	enDescription?: string;
	zhDescription?: string;
	category?: string;
	iconEmoji?: string;
	confidence?: number;
}

/**
 * 使用 AI 从工具信息中提取标签
 */
async function extractToolTags(toolId: string): Promise<{
	success: boolean;
	tagCount?: number;
	error?: string;
}> {
	try {
		// 1. 获取工具信息
		const toolResult = (await db
			.select()
			.from(tools)
			.where(eq(tools.id, toolId))
			.limit(1)) as any[];

		if (!toolResult || toolResult.length === 0) {
			return { success: false, error: 'Tool not found' };
		}

		const tool = toolResult[0];

		// 获取翻译
		const translations = (await db
			.select()
			.from(toolTranslations)
			.where(eq(toolTranslations.toolId, toolId))) as any[];

		// 2. 准备工具信息用于 AI 分析
		const toolInfo = {
			name: tool.name,
			url: tool.url,
			translations: translations,
		};

		// 3. 使用 AI 提取标签
		const prompt = `你是一个专业的工具分类专家。请根据以下工具信息，从标签白名单中选择 ${MIN_TAGS_PER_TOOL}-${MAX_TAGS_PER_TOOL} 个最相关的标签。

工具信息：
- 名称: ${toolInfo.name}
- URL: ${toolInfo.url}
- 描述: ${toolInfo.translations.map((t: any) => `${t.locale}: ${t.description}`).join('\n')}

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
    }
  ]
}

注意：
- slug 必须完全匹配白名单中的值（小写，用连字符分隔）
- 按优先级顺序返回标签（type > pricing > platform > feature > general）
- 置信度高的标签排在前面`;

		let extractedTags: ExtractedTag[] = [];
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const message = await anthropic.messages.create({
					model: 'claude-opus-4-6',
					max_tokens: 2000,
					messages: [{ role: 'user', content: prompt }],
				});

				const textContent = message.content
					.filter((block): block is { type: 'text'; text: string } => block.type === 'text')
					.map((block) => block.text)
					.join('\n')
					.trim();

				if (!textContent) {
					throw new Error('Empty AI response content');
				}

				const jsonText = extractJsonObject(textContent);
				const result = JSON.parse(jsonText) as { tags: ExtractedTag[] };

				if (!result.tags || !Array.isArray(result.tags)) {
					throw new Error('Invalid JSON format: missing tags array');
				}

				extractedTags = result.tags;
				lastError = null;
				break;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				if (attempt < 3) {
					console.warn(`AI 解析失败，第 ${attempt} 次重试: ${lastError.message}`);
					await sleep(attempt * 1000);
				}
			}
		}

		if (lastError) {
			throw lastError;
		}

		// 验证标签是否在白名单中
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

		// 按置信度排序
		extractedTags.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

		// 限制标签数量
		if (extractedTags.length > MAX_TAGS_PER_TOOL) {
			extractedTags = extractedTags.slice(0, MAX_TAGS_PER_TOOL);
		}

		if (extractedTags.length < MIN_TAGS_PER_TOOL) {
			console.warn(
				`Only ${extractedTags.length} tags extracted, less than minimum ${MIN_TAGS_PER_TOOL}`
			);
		}

		// 5. 创建或更新标签
		const tagSlugs: string[] = [];

		for (const tag of extractedTags) {
			const existingTagResult = (await db
				.select()
				.from(toolTags)
				.where(eq(toolTags.slug, tag.slug))
				.limit(1)) as any[];

			if (existingTagResult && existingTagResult.length > 0) {
				tagSlugs.push(existingTagResult[0].slug);
			} else {
				// 创建新标签
				await db.transaction(async (tx) => {
					await tx.insert(toolTags).values({
						id: nanoid(),
						slug: tag.slug,
						category: tag.category || 'general',
						status: 'draft',
						sortOrder: 0,
						usageCount: 0,
					});

					if (tag.enName) {
						await tx.insert(toolTagTranslations).values({
							id: nanoid(),
							slug: tag.slug,
							locale: 'en',
							name: tag.enName,
							description: tag.enDescription || null,
						});
					}

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

				console.log(`✓ 创建新标签: ${tag.slug}`);
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

		// 7. 更新标签的使用次数
		await db.execute(sql`
      UPDATE tool_tags
      SET usage_count = (
        SELECT COUNT(*)
        FROM tools
        WHERE tags::jsonb @> jsonb_build_array(tool_tags.slug)
      ),
      updated_at = NOW()
    `);

		return { success: true, tagCount: tagSlugs.length };
	} catch (error) {
		console.error('Error extracting tool tags:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to extract tool tags',
		};
	}
}

/**
 * 批量重新为所有工具打标签
 */

interface RetagOptions {
  limit?: number; // 限制处理的工具数量（用于测试）
  offset?: number; // 跳过前 N 个工具
  delayMs?: number; // 每个工具之间的延迟（毫秒）
  dryRun?: boolean; // 是否为试运行（不实际更新数据库）
}

export async function retagAllTools(options: RetagOptions = {}) {
  const {
    limit,
    offset = 0,
    delayMs = 2000, // 默认延迟 2 秒，避免 API 限流
    dryRun = false,
  } = options;

  console.log('=== 批量重新打标签 ===\n');
  console.log(`配置:`);
  console.log(`  - 限制数量: ${limit || '无限制'}`);
  console.log(`  - 跳过数量: ${offset}`);
  console.log(`  - 延迟时间: ${delayMs}ms`);
  console.log(`  - 试运行: ${dryRun ? '是' : '否'}`);
  console.log('');

  try {
    // 1. 获取所有已发布的工具
    let query = db
      .select({
        id: tools.id,
        name: tools.name,
        url: tools.url,
      })
      .from(tools)
      .where(eq(tools.published, true))
      .orderBy(tools.createdAt);

    if (limit) {
      query = query.limit(limit);
    }

    if (offset > 0) {
      query = query.offset(offset);
    }

    const allTools = await query;

    console.log(`📊 找到 ${allTools.length} 个已发布的工具\n`);

    if (allTools.length === 0) {
      console.log('没有需要处理的工具');
      return {
        success: true,
        totalCount: 0,
        successCount: 0,
        failedCount: 0,
      };
    }

    // 2. 为每个工具重新打标签
    let successCount = 0;
    let failedCount = 0;
    const failedTools: Array<{ id: string; name: string; error: string }> = [];

    for (let i = 0; i < allTools.length; i++) {
      const tool = allTools[i];
      const progress = `[${i + 1}/${allTools.length}]`;

      console.log(`${progress} 处理工具: ${tool.name}`);

      if (dryRun) {
        console.log(`  ⏭️  试运行模式，跳过实际处理\n`);
        continue;
      }

      try {
        // 调用 AI 打标签
        const result = await extractToolTags(tool.id);

        if (result.success) {
          const tagCount = result.tagCount || 0;
          console.log(`  ✓ 成功打标签，共 ${tagCount} 个标签\n`);
          successCount++;
        } else {
          const error = result.error || 'Unknown error';
          console.log(`  ✗ 打标签失败: ${error}\n`);
          failedCount++;
          failedTools.push({
            id: tool.id,
            name: tool.name,
            error,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`  ✗ 打标签失败: ${errorMessage}\n`);
        failedCount++;
        failedTools.push({
          id: tool.id,
          name: tool.name,
          error: errorMessage,
        });
      }

      // 延迟避免 API 限流
      if (i < allTools.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    // 3. 输出统计信息
    console.log('\n=== 处理完成 ===\n');
    console.log(`📊 统计信息:`);
    console.log(`  - 总数: ${allTools.length}`);
    console.log(`  - 成功: ${successCount}`);
    console.log(`  - 失败: ${failedCount}`);
    console.log('');

    if (failedTools.length > 0) {
      console.log('❌ 失败的工具:');
      failedTools.forEach((tool) => {
        console.log(`  - ${tool.name} (${tool.id}): ${tool.error}`);
      });
      console.log('');
    }

    return {
      success: true,
      totalCount: allTools.length,
      successCount,
      failedCount,
      failedTools,
    };
  } catch (error) {
    console.error('❌ 批量打标签失败:', error);
    throw error;
  }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 从文本中提取 JSON 对象
 */
function extractJsonObject(text: string): string {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('Failed to extract JSON: no opening brace');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(firstBrace, i + 1);
        }
      }
    }
  }

  throw new Error('Failed to extract JSON: unmatched braces');
}

// 如果直接运行此脚本
if (require.main === module) {
  // 从命令行参数读取配置
  const args = process.argv.slice(2);
  const options: RetagOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--offset' && args[i + 1]) {
      options.offset = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--delay' && args[i + 1]) {
      options.delayMs = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  console.log('使用方法:');
  console.log('  pnpm tsx src/scripts/retag-all-tools.ts [选项]');
  console.log('');
  console.log('选项:');
  console.log('  --limit <数量>    限制处理的工具数量');
  console.log('  --offset <数量>   跳过前 N 个工具');
  console.log('  --delay <毫秒>    每个工具之间的延迟（默认 2000ms）');
  console.log('  --dry-run         试运行模式（不实际更新数据库）');
  console.log('');
  console.log('示例:');
  console.log('  pnpm tsx src/scripts/retag-all-tools.ts --limit 10 --dry-run');
  console.log('  pnpm tsx src/scripts/retag-all-tools.ts --offset 100 --limit 50');
  console.log('');

  retagAllTools(options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
