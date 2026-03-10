import '../lib/env-loader';
import { db } from '../db/index';
import { toolTags, toolTagTranslations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// 导入标签定义（运行 generate-tag-definitions.ts 后生成）
import { TAG_DEFINITIONS, type TagDefinition } from '@/config/tag-definitions';

/**
 * 导入标签定义到数据库
 */
async function importTagDefinitions() {
	console.log('=== 导入标签定义到数据库 ===\n');
	console.log(`总标签数: ${TAG_DEFINITIONS.length}\n`);

	let createdTags = 0;
	let updatedTags = 0;
	let createdTranslations = 0;
	let updatedTranslations = 0;

	for (const def of TAG_DEFINITIONS) {
		try {
			console.log(`处理: ${def.slug} (${def.category})`);

			// 1. 检查标签是否存在
			const existingTag = await db.query.toolTags.findFirst({
				where: eq(toolTags.slug, def.slug),
			});

			if (!existingTag) {
				// 创建新标签
				await db.insert(toolTags).values({
					id: nanoid(),
					slug: def.slug,
					category: def.category,
					status: 'draft',
					usageCount: 0,
					sortOrder: 0,
				});
				console.log(`  ✓ 创建标签`);
				createdTags++;
			} else {
				// 更新分类（如果不同）
				if (existingTag.category !== def.category) {
					await db
						.update(toolTags)
						.set({
							category: def.category,
							updatedAt: new Date(),
						})
						.where(eq(toolTags.slug, def.slug));
					console.log(`  ✓ 更新分类: ${existingTag.category} -> ${def.category}`);
				}
				updatedTags++;
			}

			// 2. 处理英文翻译
			const existingEn = await db.query.toolTagTranslations.findFirst({
				where: and(
					eq(toolTagTranslations.slug, def.slug),
					eq(toolTagTranslations.locale, 'en')
				),
			});

			if (existingEn) {
				// 更新现有翻译
				await db
					.update(toolTagTranslations)
					.set({
						name: def.en.name,
						description: def.en.description,
						updatedAt: new Date(),
					})
					.where(eq(toolTagTranslations.id, existingEn.id));
				console.log(`  ✓ 更新英文翻译: ${def.en.name}`);
				updatedTranslations++;
			} else {
				// 创建新翻译
				await db.insert(toolTagTranslations).values({
					id: nanoid(),
					slug: def.slug,
					locale: 'en',
					name: def.en.name,
					description: def.en.description,
					content: null,
				});
				console.log(`  ✓ 创建英文翻译: ${def.en.name}`);
				createdTranslations++;
			}

			// 3. 处理中文翻译
			const existingZh = await db.query.toolTagTranslations.findFirst({
				where: and(
					eq(toolTagTranslations.slug, def.slug),
					eq(toolTagTranslations.locale, 'zh')
				),
			});

			if (existingZh) {
				// 更新现有翻译
				await db
					.update(toolTagTranslations)
					.set({
						name: def.zh.name,
						description: def.zh.description,
						updatedAt: new Date(),
					})
					.where(eq(toolTagTranslations.id, existingZh.id));
				console.log(`  ✓ 更新中文翻译: ${def.zh.name}`);
				updatedTranslations++;
			} else {
				// 创建新翻译
				await db.insert(toolTagTranslations).values({
					id: nanoid(),
					slug: def.slug,
					locale: 'zh',
					name: def.zh.name,
					description: def.zh.description,
					content: null,
				});
				console.log(`  ✓ 创建中文翻译: ${def.zh.name}`);
				createdTranslations++;
			}

			console.log('');
		} catch (error) {
			console.error(`  ✗ 失败: ${def.slug}`, error);
			console.log('');
		}
	}

	console.log('=== 导入完成 ===');
	console.log(`标签:`);
	console.log(`  - 新建: ${createdTags}`);
	console.log(`  - 更新: ${updatedTags}`);
	console.log(`翻译:`);
	console.log(`  - 新建: ${createdTranslations}`);
	console.log(`  - 更新: ${updatedTranslations}`);
	console.log(`总计: ${TAG_DEFINITIONS.length} 个标签\n`);

	// 验证数据完整性
	console.log('=== 验证数据完整性 ===\n');

	const allTags = await db.query.toolTags.findMany({
		with: {
			translations: true,
		},
	});

	let completeCount = 0;
	let incompleteCount = 0;

	for (const tag of allTags) {
		const hasEn = tag.translations?.some(
			(t) => t.locale === 'en' && t.name && t.description
		);
		const hasZh = tag.translations?.some(
			(t) => t.locale === 'zh' && t.name && t.description
		);

		if (hasEn && hasZh) {
			completeCount++;
		} else {
			incompleteCount++;
			console.log(`⚠️  不完整: ${tag.slug}`);
			if (!hasEn) console.log(`   - 缺少英文翻译`);
			if (!hasZh) console.log(`   - 缺少中文翻译`);
		}
	}

	console.log(`\n完整标签: ${completeCount}`);
	console.log(`不完整标签: ${incompleteCount}`);

	if (incompleteCount === 0) {
		console.log('\n✅ 所有标签数据完整！');
	} else {
		console.log('\n⚠️  存在不完整的标签，请检查');
	}
}

// 运行脚本
if (require.main === module) {
	importTagDefinitions()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
