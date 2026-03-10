import '../lib/env-loader';
import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function checkTranslations() {
  console.log('=== 检查标签翻译状态 ===\n');

  // 使用原生 SQL 查询
  const result = await db.execute(sql`
    WITH tag_translation_status AS (
      SELECT
        tt.slug,
        tt.category,
        tt.usage_count,
        COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'en') as has_en,
        COUNT(DISTINCT ttt.locale) FILTER (WHERE ttt.locale = 'zh') as has_zh
      FROM tool_tags tt
      LEFT JOIN tool_tag_translations ttt ON tt.slug = ttt.slug
      GROUP BY tt.slug, tt.category, tt.usage_count
    )
    SELECT
      slug,
      category,
      usage_count,
      CASE
        WHEN has_en = 0 AND has_zh = 0 THEN 'both'
        WHEN has_en = 0 THEN 'en'
        WHEN has_zh = 0 THEN 'zh'
        ELSE 'complete'
      END as status
    FROM tag_translation_status
    ORDER BY usage_count DESC
  `);

  const tags = result as unknown as Array<{
    slug: string;
    category: string;
    usage_count: number;
    status: string;
  }>;

  const totalCount = tags.length;
  const completeCount = tags.filter((t) => t.status === 'complete').length;
  const missingEnCount = tags.filter((t) => t.status === 'en').length;
  const missingZhCount = tags.filter((t) => t.status === 'zh').length;
  const missingBothCount = tags.filter((t) => t.status === 'both').length;

  console.log(`总标签数: ${totalCount}\n`);
  console.log('📊 统计结果:');
  console.log(`  - 翻译完整: ${completeCount}`);
  console.log(`  - 缺少英文: ${missingEnCount}`);
  console.log(`  - 缺少中文: ${missingZhCount}`);
  console.log(`  - 两者都缺: ${missingBothCount}`);
  console.log('');

  const missingTags = tags.filter((t) => t.status !== 'complete');

  if (missingTags.length > 0) {
    console.log(`❌ 缺少翻译的标签 (前 20 个):`);
    missingTags.slice(0, 20).forEach((tag, index) => {
      console.log(
        `  ${index + 1}. ${tag.slug} (${tag.category}) - ${tag.usage_count} 次使用 - 缺少: ${tag.status}`,
      );
    });
  } else {
    console.log('✅ 所有标签的翻译都已完整！');
  }

  process.exit(0);
}

checkTranslations().catch((error) => {
  console.error('错误:', error);
  process.exit(1);
});
