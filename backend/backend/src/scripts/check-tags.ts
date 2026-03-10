/**
 * 检查标签数据库状态（多语言版本）
 */

import { db } from '@/db';
import { toolTags } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function checkTags() {
  try {
    const allTags = await db.select().from(toolTags);
    const enTags = await db
      .select()
      .from(toolTags)
      .where(eq(toolTags.locale, 'en'));
    const zhTags = await db
      .select()
      .from(toolTags)
      .where(eq(toolTags.locale, 'zh'));

    console.log('\n========================================');
    console.log('标签数据库状态检查（多语言版本）');
    console.log('========================================\n');

    console.log(`总标签记录数: ${allTags.length}`);
    console.log(`英文标签数: ${enTags.length}`);
    console.log(`中文标签数: ${zhTags.length}`);
    console.log(
      `唯一标签数 (slug): ${new Set(allTags.map((t) => t.slug)).size}\n`
    );

    if (enTags.length > 0) {
      console.log('标签列表（前 20 个，英文版本）:\n');
      enTags.slice(0, 20).forEach((tag, index) => {
        console.log(`${index + 1}. ${tag.name} (${tag.slug})`);
        console.log(`   分类: ${tag.category || '未分类'}`);
        console.log(
          `   状态: ${tag.published ? '已发布' : '草稿'} ${tag.featured ? '| 精选' : ''}`
        );
        console.log(`   使用次数: ${tag.usageCount}`);
        console.log('');
      });

      // 按分类统计（使用英文标签）
      const categoryStats = enTags.reduce(
        (acc, tag) => {
          const category = tag.category || '未分类';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log('\n分类统计:');
      Object.entries(categoryStats).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });

      // 状态统计（使用英文标签）
      const publishedCount = enTags.filter((t) => t.published).length;
      const featuredCount = enTags.filter((t) => t.featured).length;

      console.log('\n状态统计:');
      console.log(`  已发布: ${publishedCount}`);
      console.log(`  草稿: ${enTags.length - publishedCount}`);
      console.log(`  精选: ${featuredCount}`);

      // 语言完整性检查
      const enSlugs = new Set(enTags.map((t) => t.slug));
      const zhSlugs = new Set(zhTags.map((t) => t.slug));
      const missingZh = [...enSlugs].filter((slug) => !zhSlugs.has(slug));
      const missingEn = [...zhSlugs].filter((slug) => !enSlugs.has(slug));

      console.log('\n语言完整性检查:');
      if (missingZh.length > 0) {
        console.log(
          `  ⚠️  缺少中文翻译的标签 (${missingZh.length}): ${missingZh.join(', ')}`
        );
      }
      if (missingEn.length > 0) {
        console.log(
          `  ⚠️  缺少英文翻译的标签 (${missingEn.length}): ${missingEn.join(', ')}`
        );
      }
      if (missingZh.length === 0 && missingEn.length === 0) {
        console.log('  ✅ 所有标签都有完整的英文和中文版本');
      }
    } else {
      console.log('⚠️  数据库中暂无标签数据');
      console.log('\n建议运行以下命令初始化标签:');
      console.log('  pnpm tsx src/scripts/migrate-tags.ts');
    }

    console.log('\n========================================\n');
  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  }
}

checkTags()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('执行失败:', error);
    process.exit(1);
  });
