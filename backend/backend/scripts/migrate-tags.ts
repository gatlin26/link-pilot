/**
 * 标签迁移脚本
 * 从 tools.tags JSON 字段中提取所有唯一标签，并导入到 toolTags 表
 */

import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import { getDb } from '../src/db/index.js';
import { toolTags, tools } from '../src/db/schema.js';

// 加载 .env.local 文件
dotenv.config({ path: '.env.local' });

async function migrateTags() {
  console.log('开始提取标签...\n');

  const db = await getDb();

  try {
    // 1. 获取所有工具的 tags 字段
    const allTools = await db
      .select({ id: tools.id, tags: tools.tags })
      .from(tools);

    console.log(`找到 ${allTools.length} 个工具\n`);

    // 2. 提取所有唯一的标签（按 slug 去重）
    const tagMap = new Map<string, string>(); // slug -> name

    for (const tool of allTools) {
      if (tool.tags) {
        try {
          const tagsArray = JSON.parse(tool.tags);
          if (Array.isArray(tagsArray)) {
            for (const tag of tagsArray) {
              if (typeof tag === 'string' && tag.trim()) {
                const slug = tag.trim().toLowerCase().replace(/\s+/g, '-');
                // 如果 slug 已存在，保留第一个遇到的名称
                if (!tagMap.has(slug)) {
                  tagMap.set(slug, tag.trim());
                }
              }
            }
          }
        } catch (error) {
          console.warn(`工具 ${tool.id} 的 tags 字段解析失败:`, error);
        }
      }
    }

    const uniqueTags = Array.from(tagMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([slug, name]) => ({ slug, name }));

    console.log(`提取到 ${uniqueTags.length} 个唯一标签:\n`);
    uniqueTags.forEach(({ slug, name }) => {
      console.log(`  - ${name} (${slug})`);
    });
    console.log('\n');

    // 3. 检查已存在的标签
    const existingTags = await db.select().from(toolTags);
    const existingSlugs = new Set(existingTags.map((t) => t.slug));

    console.log(`数据库中已有 ${existingTags.length} 个标签\n`);

    // 4. 准备要插入的新标签
    const tagsToInsert = uniqueTags
      .filter(({ slug }) => !existingSlugs.has(slug))
      .map(({ slug, name }) => ({
        id: nanoid(),
        slug,
        name,
        enName: name,
        zhName: name,
        description: null,
        enDescription: null,
        zhDescription: null,
        category: '通用',
        color: '#3B82F6',
        icon: null,
        iconEmoji: null,
        sortOrder: 0,
        usageCount: 0,
        isActive: true,
        published: true,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

    if (tagsToInsert.length === 0) {
      console.log('✅ 没有新标签需要插入，所有标签已存在');
      return;
    }

    console.log(`准备插入 ${tagsToInsert.length} 个新标签:\n`);
    for (const tag of tagsToInsert) {
      console.log(`  - ${tag.name} (${tag.slug})`);
    }
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
