import '../lib/env-loader';
import { db } from '../db/index';
import { toolTags, toolTagTranslations } from '@/db/schema';
import { sql, count, eq } from 'drizzle-orm';

async function verifyImport() {
  console.log('=== 验证标签导入结果 ===\n');

  try {
    // 使用 Drizzle ORM 查询
    const tagCountResult = await db.select({ count: count() }).from(toolTags);
    const tagCount = tagCountResult[0]?.count || 0;

    const translationCountResult = await db.select({ count: count() }).from(toolTagTranslations);
    const translationCount = translationCountResult[0]?.count || 0;

    const enCountResult = await db
      .select({ count: count() })
      .from(toolTagTranslations)
      .where(eq(toolTagTranslations.locale, 'en'));
    const enCount = enCountResult[0]?.count || 0;

    const zhCountResult = await db
      .select({ count: count() })
      .from(toolTagTranslations)
      .where(eq(toolTagTranslations.locale, 'zh'));
    const zhCount = zhCountResult[0]?.count || 0;

    console.log('📊 标签表状态:');
    console.log(`  - 标签总数: ${tagCount}`);
    console.log(`  - 翻译总数: ${translationCount}`);
    console.log(`  - 英文翻译: ${enCount}`);
    console.log(`  - 中文翻译: ${zhCount}`);
    console.log('');

    // 查询示例标签
    const sampleTags = await db
      .select({
        slug: toolTags.slug,
        category: toolTags.category,
        status: toolTags.status,
      })
      .from(toolTags)
      .limit(10);

    console.log('📝 示例标签（前 10 个）:');
    sampleTags.forEach((tag, i) => {
      console.log(`  ${i + 1}. ${tag.slug} (${tag.category}) - ${tag.status}`);
    });
    console.log('');

    // 按类别统计
    const categoryStats = await db.execute(sql`
      SELECT category, COUNT(*) as count
      FROM tool_tags
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('📂 按类别统计:');
    if (categoryStats.rows && categoryStats.rows.length > 0) {
      categoryStats.rows.forEach((row: any) => {
        console.log(`  - ${row.category}: ${row.count} 个标签`);
      });
    }
    console.log('');

    console.log('✅ 验证完成！');
    console.log('');
    console.log('📋 下一步操作:');
    console.log('  1. 运行标签状态更新脚本:');
    console.log('     pnpm tsx src/lib/cron/update-tag-status.ts');
    console.log('');
    console.log('  2. 为所有工具重新打标签:');
    console.log('     pnpm tsx src/scripts/retag-all-tools.ts --limit 50');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  }
}

verifyImport();
