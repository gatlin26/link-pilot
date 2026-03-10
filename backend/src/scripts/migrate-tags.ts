/**
 * 标签迁移脚本
 * 从 tools.tags JSON 字段中提取所有唯一标签，并导入到 toolTags 表
 */

import { db } from '@/db';
import { toolTags, tools } from '@/db/schema';
import { nanoid } from 'nanoid';

async function migrateTags() {
  console.log('开始提取标签...\n');

  try {
    // 1. 获取所有工具的 tags 字段
    const allTools = await db
      .select({ id: tools.id, tags: tools.tags })
      .from(tools);

    console.log(`找到 ${allTools.length} 个工具\n`);

    // 2. 提取所有唯一的标签
    const tagSet = new Set<string>();

    for (const tool of allTools) {
      if (tool.tags) {
        try {
          const tagsArray = JSON.parse(tool.tags);
          if (Array.isArray(tagsArray)) {
            tagsArray.forEach((tag) => {
              if (typeof tag === 'string' && tag.trim()) {
                tagSet.add(tag.trim());
              }
            });
          }
        } catch (error) {
          console.warn(`工具 ${tool.id} 的 tags 字段解析失败:`, error);
        }
      }
    }

    const uniqueTags = Array.from(tagSet).sort();
    console.log(`提取到 ${uniqueTags.length} 个唯一标签:\n`);
    console.log(uniqueTags.join(', '));
    console.log('\n');

    // 3. 检查已存在的标签
    const existingTags = await db.select().from(toolTags);
    const existingSlugs = new Set(existingTags.map((t) => t.slug));

    console.log(`数据库中已有 ${existingTags.length} 个标签\n`);

    // 4. 准备要插入的新标签
    const tagsToInsert = uniqueTags
      .filter((tag) => {
        const slug = tag.toLowerCase().replace(/\s+/g, '-');
        return !existingSlugs.has(slug);
      })
      .map((tag) => {
        const slug = tag.toLowerCase().replace(/\s+/g, '-');
        return {
          id: nanoid(),
          slug,
          name: tag,
          description: null,
          category: 'general',
          color: '#3B82F6',
          icon: null,
          sortOrder: 0,
          usageCount: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

    if (tagsToInsert.length === 0) {
      console.log('没有新标签需要插入');
      return;
    }

    console.log(`准备插入 ${tagsToInsert.length} 个新标签:\n`);
    tagsToInsert.forEach((tag) => {
      console.log(`  - ${tag.name} (${tag.slug})`);
    });
    console.log('\n');

    // 5. 批量插入新标签
    await db.insert(toolTags).values(tagsToInsert);

    console.log('✅ 标签迁移完成！\n');

    // 6. 显示统计信息
    const finalTags = await db.select().from(toolTags);
    console.log(`数据库中现在共有 ${finalTags.length} 个标签`);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  }
}

// 执行迁移
migrateTags()
  .then(() => {
    console.log('\n迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n迁移脚本执行失败:', error);
    process.exit(1);
  });
