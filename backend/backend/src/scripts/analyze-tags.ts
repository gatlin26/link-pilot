import '../lib/env-loader';
import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function analyzeTags() {
	console.log('=== 标签数据分析 ===\n');

	// 1. 总标签数
	const totalResult = await db.execute(sql`SELECT COUNT(*) as total FROM tool_tags`);
	const total = (totalResult[0] as any)?.total || 0;
	console.log(`📊 标签总数: ${total}\n`);

	// 2. 按类别统计
	const categoryResult = await db.execute(sql`
		SELECT category, COUNT(*) as count
		FROM tool_tags
		GROUP BY category
		ORDER BY count DESC
	`);
	console.log('📂 按类别统计:');
	(categoryResult as any[]).forEach((row: any) => {
		console.log(`  - ${row.category || 'null'}: ${row.count}`);
	});
	console.log('');

	// 3. 使用频率最高的前 30 个标签
	const topUsedResult = await db.execute(sql`
		SELECT slug, usage_count, category, status
		FROM tool_tags
		ORDER BY usage_count DESC
		LIMIT 30
	`);
	console.log('🔥 使用频率最高的前 30 个标签:');
	(topUsedResult as any[]).forEach((row: any, index: number) => {
		console.log(`  ${index + 1}. ${row.slug} (${row.category}) - 使用 ${row.usage_count} 次 [${row.status}]`);
	});
	console.log('');

	// 4. 未使用的标签
	const unusedResult = await db.execute(sql`
		SELECT COUNT(*) as count
		FROM tool_tags
		WHERE usage_count = 0
	`);
	console.log(`❌ 未使用的标签: ${(unusedResult[0] as any)?.count || 0}\n`);

	// 5. 薄内容标签（使用次数 < 5）
	const thinResult = await db.execute(sql`
		SELECT COUNT(*) as count
		FROM tool_tags
		WHERE usage_count > 0 AND usage_count < 5
	`);
	console.log(`⚠️  薄内容标签 (1-4 次使用): ${(thinResult[0] as any)?.count || 0}\n`);

	// 6. 按状态统计
	const statusResult = await db.execute(sql`
		SELECT status, COUNT(*) as count
		FROM tool_tags
		GROUP BY status
		ORDER BY count DESC
	`);
	console.log('📌 按状态统计:');
	(statusResult as any[]).forEach((row: any) => {
		console.log(`  - ${row.status}: ${row.count}`);
	});
	console.log('');

	// 7. 检测可能重复的标签（单复数、相似名称）
	const allTagsResult = await db.execute(sql`
		SELECT slug FROM tool_tags ORDER BY slug
	`);
	const allSlugs = (allTagsResult as any[]).map((row: any) => row.slug);

	console.log('🔍 可能重复的标签（单复数形式）:');
	const duplicates = new Set<string>();
	allSlugs.forEach((slug: string) => {
		// 检查单复数
		if (slug.endsWith('s')) {
			const singular = slug.slice(0, -1);
			if (allSlugs.includes(singular) && !duplicates.has(slug) && !duplicates.has(singular)) {
				console.log(`  - "${singular}" vs "${slug}"`);
				duplicates.add(slug);
				duplicates.add(singular);
			}
		}
	});
	console.log('');

	process.exit(0);
}

analyzeTags().catch(console.error);
