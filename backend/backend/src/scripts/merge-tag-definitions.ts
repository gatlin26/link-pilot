import * as fs from 'fs';
import * as path from 'path';

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
 * 合并所有批次的结果
 */
async function mergeResults() {
	console.log('=== 合并标签定义 ===\n');

	const outputDir = path.join(process.cwd(), '.tmp/tag-definitions');

	if (!fs.existsSync(outputDir)) {
		console.error('错误: 未找到批次结果目录');
		process.exit(1);
	}

	// 读取所有批次文件
	const files = fs.readdirSync(outputDir).filter((f) => f.startsWith('batch-') && f.endsWith('.json'));

	console.log(`找到 ${files.length} 个批次文件\n`);

	const allDefinitions: TagDefinition[] = [];
	const allFailed: string[] = [];

	// 按批次索引排序
	files.sort((a, b) => {
		const aIndex = parseInt(a.match(/batch-(\d+)\.json/)?.[1] || '0');
		const bIndex = parseInt(b.match(/batch-(\d+)\.json/)?.[1] || '0');
		return aIndex - bIndex;
	});

	for (const file of files) {
		const filePath = path.join(outputDir, file);
		const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

		console.log(`批次 ${data.batchIndex + 1}:`);
		console.log(`  成功: ${data.successful.length}`);
		console.log(`  失败: ${data.failed.length}`);

		allDefinitions.push(...data.successful);
		allFailed.push(...data.failed);
	}

	console.log(`\n=== 合并完成 ===`);
	console.log(`总成功: ${allDefinitions.length}`);
	console.log(`总失败: ${allFailed.length}`);

	if (allFailed.length > 0) {
		console.log(`\n失败的标签:`);
		allFailed.forEach((slug) => console.log(`  - ${slug}`));
	}

	// 按 slug 排序
	allDefinitions.sort((a, b) => a.slug.localeCompare(b.slug));

	// 保存到最终文件
	const outputPath = path.join(process.cwd(), 'src/config/tag-definitions.ts');
	const fileContent = `/**
 * 标签定义配置
 *
 * 此文件由并行生成脚本自动生成
 * 包含所有标签的完整定义（英文和中文）以及参考来源
 *
 * 生成时间: ${new Date().toISOString()}
 * 标签数量: ${allDefinitions.length}
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

export const TAG_DEFINITIONS: TagDefinition[] = ${JSON.stringify(allDefinitions, null, 2)};

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
	console.log(`\n✓ 已保存到: ${outputPath}`);

	// 统计参考来源
	const wikiCount = allDefinitions.filter(
		(d) => d.references?.en?.source === 'wikipedia' || d.references?.zh?.source === 'wikipedia'
	).length;
	const aiCount = allDefinitions.filter(
		(d) =>
			d.references?.en?.source === 'ai-generated' || d.references?.zh?.source === 'ai-generated'
	).length;

	console.log('\n=== 参考来源统计 ===');
	console.log(`维基百科: ${wikiCount} 个标签`);
	console.log(`AI 生成: ${aiCount} 个标签`);
}

mergeResults().catch(console.error);
