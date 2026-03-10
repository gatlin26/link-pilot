/**
 * 修复标签分类字段
 * 将中文的 category 值转换为英文值
 */

import { db } from '@/db';
import { toolTags } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

// 中文到英文的映射
const categoryMap: Record<string, string> = {
  类型: 'type',
  定价: 'pricing',
  平台: 'platform',
  功能: 'feature',
  通用: 'general',
  其他: 'other',
};

async function fixTagCategories() {
  console.log('开始修复标签分类字段...\n');

  try {
    // 1. 查找所有使用中文 category 的标签
    const chineseCategories = Object.keys(categoryMap);
    const tagsWithChineseCategory = await db
      .select()
      .from(toolTags)
      .where(or(...chineseCategories.map((cat) => eq(toolTags.category, cat))));

    console.log(
      `找到 ${tagsWithChineseCategory.length} 个使用中文分类的标签\n`
    );

    if (tagsWithChineseCategory.length === 0) {
      console.log('没有需要修复的标签');
      return;
    }

    // 2. 更新每个标签的 category
    let updatedCount = 0;
    for (const tag of tagsWithChineseCategory) {
      const chineseCategory = tag.category;
      if (chineseCategory && categoryMap[chineseCategory]) {
        const englishCategory = categoryMap[chineseCategory];

        await db
          .update(toolTags)
          .set({
            category: englishCategory,
            updatedAt: new Date(),
          })
          .where(eq(toolTags.id, tag.id));

        console.log(
          `  ✓ ${tag.name} (${tag.slug}): ${chineseCategory} → ${englishCategory}`
        );
        updatedCount++;
      }
    }

    console.log(`\n✅ 成功更新 ${updatedCount} 个标签的分类字段`);
  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  }
}

// 执行修复
fixTagCategories()
  .then(() => {
    console.log('\n修复脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n修复脚本执行失败:', error);
    process.exit(1);
  });
