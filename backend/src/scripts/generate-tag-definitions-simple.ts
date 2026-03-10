import '../lib/env-loader';
import { getAllWhitelistTags, getTagCategory } from '@/config/tag-whitelist';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
});

interface TagDefinition {
	slug: string;
	category: string;
	references?: {
		en?: {
			source: string;
			content: string;
		};
		zh?: {
			source: string;
			content: string;
		};
	};
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
 * 从维基百科获取参考内容
 */
async function fetchFromWikipedia(
	slug: string,
	language: 'en' | 'zh'
): Promise<{ source: string; content: string } | null> {
	try {
		// 将 slug 转换为维基百科搜索词
		const searchTerm = slug.replace(/-/g, ' ');
		const wikiLang = language === 'zh' ? 'zh' : 'en';
		const wikiUrl = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`;

		console.log(`      尝试: ${wikiUrl}`);

		// 使用维基百科 API 获取摘要
		const apiUrl = `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`;
		const response = await fetch(apiUrl);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		if (data.type === 'disambiguation' || !data.extract) {
			return null;
		}

		return {
			source: 'wikipedia',
			content: data.extract,
		};
	} catch (error) {
		console.log(`      未找到维基百科条目`);
		return null;
	}
}

/**
 * 使用 AI 生成参考内容（当维基百科没有时）
 */
async function generateReferenceWithAI(
	slug: string,
	category: string,
	language: 'en' | 'zh'
): Promise<{ source: string; content: string }> {
	const prompt = `你是一个专业的技术词典编辑。请为以下标签生成参考定义。

标签: ${slug}
分类: ${category}
语言: ${language === 'zh' ? '中文' : '英文'}

要求：
1. 提供准确、专业的定义
2. 说明该标签在技术/商业领域的含义和应用
3. 内容应该客观、中立、权威
4. 200-300 字
5. 使用 ${language === 'zh' ? '中文' : '英文'}

只返回定义内容，不要包含其他说明。`;

	const message = await anthropic.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 1000,
		messages: [{ role: 'user', content: prompt }],
	});

	const content = message.content[0];
	if (content.type !== 'text') {
		throw new Error('Unexpected response type');
	}

	return {
		source: 'ai-generated',
		content: content.text.trim(),
	};
}

/**
 * 使用 AI 批量生成标签定义（基于参考内容）
 */
async function generateTagDefinitionsWithReferences() {
	console.log('=== 批量生成标签定义（基于维基百科参考）===\n');

	const allTags = getAllWhitelistTags();
	console.log(`总标签数: ${allTags.length}\n`);

	const definitions: TagDefinition[] = [];
	let successCount = 0;
	let failedCount = 0;

	// 分批处理，每批 5 个标签
	const batchSize = 5;
	for (let i = 0; i < allTags.length; i += batchSize) {
		const batch = allTags.slice(i, i + batchSize);
		console.log(
			`\n处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(allTags.length / batchSize)}`
		);
		console.log(`标签: ${batch.join(', ')}\n`);

		for (const slug of batch) {
			try {
				const category = getTagCategory(slug) || 'general';
				console.log(`  处理: ${slug} (${category})`);

				// 1. 获取英文参考
				console.log(`    - 获取英文参考...`);
				let enReference = await fetchFromWikipedia(slug, 'en');
				if (!enReference) {
					console.log(`      维基百科未找到，使用 AI 生成`);
					enReference = await generateReferenceWithAI(slug, category, 'en');
				} else {
					console.log(`      ✓ 从维基百科获取`);
				}

				// 2. 获取中文参考
				console.log(`    - 获取中文参考...`);
				let zhReference = await fetchFromWikipedia(slug, 'zh');
				if (!zhReference) {
					console.log(`      维基百科未找到，使用 AI 生成`);
					zhReference = await generateReferenceWithAI(slug, category, 'zh');
				} else {
					console.log(`      ✓ 从维基百科获取`);
				}

				// 3. 基于参考内容生成定义
				console.log(`    - 生成标签定义...`);
				const prompt = `你是一个专业的标签定义专家。请基于以下参考内容，生成标签的定义。

标签: ${slug}
分类: ${category}

英文参考内容：
${enReference.content}

中文参考内容：
${zhReference.content}

要求：
1. 基于参考内容生成准确的定义
2. 生成英文和中文的 name 和 description
3. name 应该简洁、专业（如 "AI Image Generator"）
4. description 应该简洁（50-100 字符），适合用作 SEO meta description
5. description 应该是对 name 的简短说明，不要重复 name

返回 JSON 格式：
{
  "en": {
    "name": "AI Image Generator",
    "description": "Tools that use artificial intelligence to generate images from text prompts or other inputs"
  },
  "zh": {
    "name": "AI 图像生成器",
    "description": "使用人工智能从文本提示或其他输入生成图像的工具"
  }
}`;

				const message = await anthropic.messages.create({
					model: 'claude-opus-4-6',
					max_tokens: 1000,
					messages: [{ role: 'user', content: prompt }],
				});

				const content = message.content[0];
				if (content.type !== 'text') {
					throw new Error('Unexpected response type');
				}

				const jsonMatch = content.text.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					throw new Error('Failed to extract JSON');
				}

				const result = JSON.parse(jsonMatch[0]);

				// 4. 构建完整的标签定义
				const definition: TagDefinition = {
					slug,
					category,
					references: {
						en: enReference,
						zh: zhReference,
					},
					en: result.en,
					zh: result.zh,
				};

				definitions.push(definition);
				successCount++;
				console.log(`    ✓ 成功生成定义\n`);

				// 延迟避免 API 限流
				await new Promise((resolve) => setTimeout(resolve, 2000));
			} catch (error) {
				console.error(`    ✗ 失败: ${slug}`, error);
				failedCount++;
			}
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
 * 此文件由 generate-tag-definitions-simple.ts 脚本自动生成
 * 包含所有标签的完整定义（英文和中文）以及参考来源
 *
 * 生成时间: ${new Date().toISOString()}
 * 标签数量: ${definitions.length}
 */

export interface TagDefinition {
  slug: string;
  category: string;
  references?: {
    en?: {
      source: string;  // 'wikipedia' | 'ai-generated'
      content: string;
    };
    zh?: {
      source: string;
      content: string;
    };
  };
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

	// 统计参考来源
	const wikiCount = definitions.filter(
		(d) => d.references?.en?.source === 'wikipedia' || d.references?.zh?.source === 'wikipedia'
	).length;
	const aiCount = definitions.filter(
		(d) => d.references?.en?.source === 'ai-generated' || d.references?.zh?.source === 'ai-generated'
	).length;

	console.log('=== 参考来源统计 ===');
	console.log(`维基百科: ${wikiCount} 个标签`);
	console.log(`AI 生成: ${aiCount} 个标签`);

	return definitions;
}

// 运行脚本
if (require.main === module) {
	generateTagDefinitionsWithReferences()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
