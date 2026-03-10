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
		const searchTerm = slug.replace(/-/g, ' ');
		const wikiLang = language === 'zh' ? 'zh' : 'en';
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
		return null;
	}
}

/**
 * 使用 AI 生成参考内容
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
 * 处理单个标签（用于并行处理）
 */
async function processTag(slug: string): Promise<TagDefinition> {
	const category = getTagCategory(slug) || 'general';

	// 并行获取英文和中文参考
	const [enReference, zhReference] = await Promise.all([
		(async () => {
			const wiki = await fetchFromWikipedia(slug, 'en');
			return wiki || (await generateReferenceWithAI(slug, category, 'en'));
		})(),
		(async () => {
			const wiki = await fetchFromWikipedia(slug, 'zh');
			return wiki || (await generateReferenceWithAI(slug, category, 'zh'));
		})(),
	]);

	// 基于参考内容生成定义
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

	return {
		slug,
		category,
		references: {
			en: enReference,
			zh: zhReference,
		},
		en: result.en,
		zh: result.zh,
	};
}

/**
 * 并行处理标签批次
 */
async function processBatch(tags: string[], batchIndex: number, totalBatches: number) {
	console.log(`\n批次 ${batchIndex}/${totalBatches}: 处理 ${tags.length} 个标签`);
	console.log(`标签: ${tags.join(', ')}`);

	const results = await Promise.allSettled(tags.map((slug) => processTag(slug)));

	const successful: TagDefinition[] = [];
	const failed: string[] = [];

	results.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			successful.push(result.value);
			console.log(`  ✓ ${tags[index]}`);
		} else {
			failed.push(tags[index]);
			console.log(`  ✗ ${tags[index]}: ${result.reason}`);
		}
	});

	return { successful, failed };
}

/**
 * 主函数
 */
async function main() {
	const batchIndex = parseInt(process.argv[2] || '0');
	const batchSize = parseInt(process.argv[3] || '10');

	const allTags = getAllWhitelistTags();
	const startIndex = batchIndex * batchSize;
	const endIndex = Math.min(startIndex + batchSize, allTags.length);
	const batchTags = allTags.slice(startIndex, endIndex);

	if (batchTags.length === 0) {
		console.log('没有标签需要处理');
		return;
	}

	const totalBatches = Math.ceil(allTags.length / batchSize);
	console.log(`=== 处理批次 ${batchIndex + 1}/${totalBatches} ===`);
	console.log(`总标签数: ${allTags.length}`);
	console.log(`当前批次: ${startIndex + 1}-${endIndex}`);

	const { successful, failed } = await processBatch(batchTags, batchIndex + 1, totalBatches);

	// 保存结果到临时文件
	const outputDir = path.join(process.cwd(), '.tmp/tag-definitions');
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const outputFile = path.join(outputDir, `batch-${batchIndex}.json`);
	fs.writeFileSync(
		outputFile,
		JSON.stringify(
			{
				batchIndex,
				successful,
				failed,
			},
			null,
			2
		)
	);

	console.log(`\n批次 ${batchIndex + 1} 完成:`);
	console.log(`  成功: ${successful.length}`);
	console.log(`  失败: ${failed.length}`);
	console.log(`  保存到: ${outputFile}`);
}

main().catch(console.error);
