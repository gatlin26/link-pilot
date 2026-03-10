import '../lib/env-loader';
import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function verifyImport() {
  console.log('=== 验证标签导入结果 ===\n');

  try {
    // 查询标签总数
    const tagCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tags`);
    const tagCount = (tagCountResult.rows && tagCountResult.rows[0]) ? (tagCountResult.rows[0] as any).count : 0;

    // 查询翻译总数
    const translationCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tag_translations`);
    const translationCount = (translationCountResult.rows && translationCountResult.rows[0]) ? (translationCountResult.rows[0] as any).count : 0;

    // 查询英文翻译数
    const enCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tag_translations WHERE locale = 'en'`);
    const enCount = (enCountResult.rows && enCountResult.rows[0]) ? (enCountResult.rows[0] as any).count : 0;

    // 查询中文翻译数
    const zhCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM tool_tag_translations WHERE locale = 'zh'`);
    const zhCount = (zhCountResult.rows && zhCountResult.rows[0]) ? (zhCountResult.rows[0] as any).count : 0;

    console.log('📊 标签表状态:');
    console.log(`  - 标签总数: ${tagCount}`);
    console.log(`  - 翻译总数: ${translationCount}`);
    console.log(`  - 英文翻译: ${enCount}`);
    console.log(`  - 中文翻译: ${zhCount}`);
    console.log('');

    // 查询示例标签
    const sampleTagsResult = await db.execute(sql`
      SELECT slug, category, status
      FROM tool_tags
      ORDER BY category, slug
      LIMIT 10
    `);

    console.log('📝 示例标签（前 10 个）:');
    sampleTagsResult.rows.forEach((tag: any, i: number) => {
      console.log(`  ${i + 1}. ${tag.slug} (${tag.category}) - ${tag.status}`);
    });
    console.log('');

    // 按类别统计
    const categoryStatsResult = await db.execute(sql`
      SELECT category, COUNT(*) as count
      FROM tool_tags
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('📂 按类别统计:');
    categoryStatsResult.rows.forEach((row: any) => {
      console.log(`  - ${row.category}: ${row.count} 个标签`);
    });
    console.log('');

    // 检查翻译完整性
    const missingTranslationsResult = await db.execute(sql`
      WITH tag_translation_status AS (
        SELECT
          tt.slug,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
          COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
        FROM tool_tags tt
        LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
        GROUP BY tt.slug
      )
      SELECT COUNT(*) as count
      FROM tag_translation_status
      WHERE has_en = 0 OR has_zh = 0
    `);

    const missingCount = (missingTranslationsResult.rows && missingTranslationsResult.rows[0]) ? (missingTranslationsResult.rows[0] as any).count : 0;
    console.log('✅ 翻译完整性检查:');
    console.log(`  - 缺少翻译的标签: ${missingCount} 个`);
    console.log(`  - 翻译完整的标签: ${tagCount - missingCount} 个`);
    console.log('');

    if (missingCount === 0) {
      console.log('🎉 所有标签都有完整的英文和中文翻译！');
    } else {
      console.log('⚠️  有标签缺少翻译，请运行翻译补全脚本');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  }
}

verifyImport();
