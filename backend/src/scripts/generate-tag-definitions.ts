import '../lib/env-loader';
import { TAG_WHITELIST, getAllWhitelistTags, getTagCategory } from '@/config/tag-whitelist';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

interface TagDefinition {
	slug: string;
	category: string;
	en: {
		name: string;
		description: string;
	};
	zh: {
		name: string;
		description: string;
	};
}

/**
 * 使用 AI 批量生成标签定义
 */
async function generateTagDefinitions() {
	console.log('=== 批量生成标签定义 ===\n');

	const allTags = getAllWhitelistTags();
	console.log(`总标签数: ${allTags.length}\n`);

	const definitions: TagDefinition[] = [];
	let successCount = 0;
	let failedCount = 0;

	// 分批处理，每批 10 个标签
	const batchSize = 10;
	for (let i = 0; i < allTags.length; i += batchSize) {
		const batch = allTags.slice(i, i + batchSize);
		console.log(`\n处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(allTags.length / batchSize)}`);
		console.log(`标签: ${batch.join(', ')}\n`);

		try {
			const prompt = `你是一个专业的标签定义专家。请为以下标签生成完整的英文和中文定义。

标签列表：
${batch.map((slug) => `- ${slug} (${getTagCategory(slug)})`).join('\n')}

要求：
1. 为每个标签生成：
   - 英文名称（name）：简洁、专业、符合行业标准
   - 英文描述（description）：1-2 句话，清晰说明标签的含义和用途
   - 中文名称（name）：准确翻译英文名称
   - 中文描述（description）：准确翻译英文描述

2. 描述要求：
   - 简洁明了，50-100 字符
   - 面向用户，说明"这是什么"或"用于什么"
   - 避免过于技术化的术语
   - 适合用作 SEO meta description

3. 命名规范：
   - 英文名称使用 Title Case（如 "AI Image Generator"）
   - 中文名称简洁自然（如 "AI 图像生成器"）

返回 JSON 格式：
{
  "definitions": [
    {
      "slug": "ai-image-generator",
      "category": "type",
      "en": {
        "name": "AI Image Generator",
        "description": "Tools that use artificial intelligence to generate images from text prompts or other inputs"
      },
      "zh": {
        "name": "AI 图像生成器",
        "description": "使用人工智能从文本提示或其他输入生成图像的工具"
      }
    }
  ]
}`;

			const message = await anthropic.messages.create({
				model: 'claude-opus-4-6',
				max_tokens: 4000,
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

			const result = JSON.parse(jsonMatch[0]) as { definitions: TagDefinition[] };

			// 添加到结果
			definitions.push(...result.definitions);
			successCount += result.definitions.length;

			console.log(`✓ 成功生成 ${result.definitions.length} 个标签定义`);

			// 延迟避免 API 限流
			if (i + batchSize < allTags.length) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		} catch (error) {
			console.error(`✗ 批次失败:`, error);
			failedCount += batch.length;
		}
	}

	console.log('\n=== 生成完成 ===');
	console.log(`成功: ${successCount}`);
	console.log(`失败: ${failedCount}`);
	console.log(`总计: ${allTags.length}\n`);

	// 保存到文件
	const outputPath = path.join(process.cwd(), 'src/config/tag-definitions.ts');
	const fileContent = `/**
 * 标签定义配置
 *
 * 此文件由 generate-tag-definitions.ts 脚本自动生成
 * 包含所有标签的完整定义（英文和中文）
 *
 * 生成时间: ${new Date().toISOString()}
 * 标签数量: ${definitions.length}
 */

export interface TagDefinition {
  slug: string;
  category: string;
  en: {
    name: string;
    description: string;
  };
  zh: {
    name: string;
    description: string;
  };
}

export const TAG_DEFINITIONS: TagDefinition[] = ${JSON.stringify(definitions, null, 2)};

/**
 * 根据 slug 获取标签定义
 */
export function getTagDefinition(slug: string): TagDefinition | undefined {
  return TAG_DEFINITIONS.find(def => def.slug === slug);
}

/**
 * 根据分类获取标签定义
 */
export function getTagDefinitionsByCategory(category: string): TagDefinition[] {
  return TAG_DEFINITIONS.filter(def => def.category === category);
}
`;

	fs.writeFileSync(outputPath, fileContent, 'utf-8');
	console.log(`✓ 已保存到: ${outputPath}\n`);

	return definitions;
}

// 运行脚本
if (require.main === module) {
	generateTagDefinitions()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
