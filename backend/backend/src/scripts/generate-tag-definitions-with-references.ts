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
			sources: Array<{
				url: string;
				title: string;
				snippet: string;
			}>;
			summary: string;
		};
		zh?: {
			sources: Array<{
				url: string;
				title: string;
				snippet: string;
			}>;
			summary: string;
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
 * 使用 Google 搜索获取参考内容
 */
async function searchGoogle(query: string, language: string = 'en'): Promise<any[]> {
	const apiKey = process.env.GOOGLE_API_KEY;
	const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

	if (!apiKey || !searchEngineId) {
		console.warn('⚠️  Google API 未配置，跳过搜索');
		return [];
	}

	try {
		const url = new URL('https://www.googleapis.com/customsearch/v1');
		url.searchParams.set('key', apiKey);
		url.searchParams.set('cx', searchEngineId);
		url.searchParams.set('q', query);
		url.searchParams.set('num', '5'); // 获取前 5 个结果
		url.searchParams.set('lr', language === 'zh' ? 'lang_zh-CN' : 'lang_en');

		const response = await fetch(url.toString());
		const data = await response.json();

		if (!data.items) {
			return [];
		}

		return data.items.map((item: any) => ({
			url: item.link,
			title: item.title,
			snippet: item.snippet || '',
		}));
	} catch (error) {
		console.error(`Google 搜索失败: ${query}`, error);
		return [];
	}
}

/**
 * 使用 AI 总结参考内容
 */
async function summarizeReferences(
	slug: string,
	category: string,
	sources: any[],
	language: string
): Promise<string> {
	if (sources.length === 0) {
		return '';
	}

	const prompt = `你是一个专业的内容总结专家。请基于以下搜索结果，总结关于 "${slug}" 的核心信息。

标签: ${slug}
分类: ${category}
语言: ${language}

搜索结果：
${sources.map((s, i) => `${i + 1}. ${s.title}\n   ${s.snippet}\n   来源: ${s.url}`).join('\n\n')}

要求：
1. 总结 "${slug}" 的核心定义和含义
2. 说明其在技术/商业领域的应用
3. 内容应该客观、准确、简洁（200-300 字）
4. 使用 ${language === 'zh' ? '中文' : '英文'}

只返回总结内容，不要包含其他说明。`;

	const message = await anthropic.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 1000,
		messages: [{ role: 'user', content: prompt }],
	});

	const content = message.content[0];
	if (content.type !== 'text') {
		throw new Error('Unexpected response type');
	}

	return content.text.trim();
}

/**
 * 使用 AI 批量生成标签定义（基于参考内容）
 */
async function generateTagDefinitionsWithReferences() {
	console.log('=== 批量生成标签定义（基于 Google 搜索参考）===\n');

	const allTags = getAllWhitelistTags();
	console.log(`总标签数: ${allTags.length}\n`);

	const definitions: TagDefinition[] = [];
	let successCount = 0;
	let failedCount = 0;

	// 分批处理，每批 5 个标签（因为需要搜索，速度较慢）
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

				// 1. Google 搜索英文参考
				console.log(`    - 搜索英文参考...`);
				const searchQuery = slug.replace(/-/g, ' ');
				const enSources = await searchGoogle(`${searchQuery} definition technology`, 'en');
				console.log(`      找到 ${enSources.length} 个英文来源`);

				// 2. 总结英文参考
				let enSummary = '';
				if (enSources.length > 0) {
					console.log(`    - 总结英文参考...`);
					enSummary = await summarizeReferences(slug, category, enSources, 'en');
				}

				// 3. Google 搜索中文参考
				console.log(`    - 搜索中文参考...`);
				const zhSources = await searchGoogle(`${searchQuery} 定义 技术`, 'zh');
				console.log(`      找到 ${zhSources.length} 个中文来源`);

				// 4. 总结中文参考
				let zhSummary = '';
				if (zhSources.length > 0) {
					console.log(`    - 总结中文参考...`);
					zhSummary = await summarizeReferences(slug, category, zhSources, 'zh');
				}

				// 5. 基于参考内容生成定义
				console.log(`    - 生成标签定义...`);
				const prompt = `你是一个专业的标签定义专家。请基于以下参考内容，生成标签的定义。

标签: ${slug}
分类: ${category}

英文参考内容：
${enSummary || '无参考内容'}

中文参考内容：
${zhSummary || '无参考内容'}

要求：
1. 基于参考内容生成准确的定义
2. 生成英文和中文的 name 和 description
3. name 应该简洁、专业（如 "AI Image Generator"）
4. description 应该简洁（50-100 字符），适合用作 SEO meta description
5. 如果参考内容不足，基于标签名称和分类进行合理推断

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

				// 6. 构建完整的标签定义
				const definition: TagDefinition = {
					slug,
					category,
					references: {
						en: enSources.length > 0 ? { sources: enSources, summary: enSummary } : undefined,
						zh: zhSources.length > 0 ? { sources: zhSources, summary: zhSummary } : undefined,
					},
					en: result.en,
					zh: result.zh,
				};

				definitions.push(definition);
				successCount++;
				console.log(`    ✓ 成功生成定义`);

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
 * 此文件由 generate-tag-definitions-with-references.ts 脚本自动生成
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
      sources: Array<{
        url: string;
        title: string;
        snippet: string;
      }>;
      summary: string;
    };
    zh?: {
      sources: Array<{
        url: string;
        title: string;
        snippet: string;
      }>;
      summary: string;
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
