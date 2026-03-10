/**
 * 检查工具表的标签数据
 */

import { resolve } from 'node:path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import { getDb } from '../src/db';

async function checkToolsTags() {
  const db = await getDb();

  try {
    // 查询前 5 个工具的详细信息
    const tools = await db.query.tools.findMany({
      columns: {
        id: true,
        name: true,
        types: true,
        categories: true,
        tags: true,
      },
      limit: 5,
    });

    console.log('📊 工具标签数据示例:\n');

    for (const tool of tools) {
      console.log(`\n工具: ${tool.name}`);
      console.log(`  types: ${tool.types || '(空)'}`);
      console.log(`  categories: ${tool.categories || '(空)'}`);
      console.log(`  tags: ${tool.tags || '(空)'}`);
    }

    // 统计有数据的工具数量
    const allTools = await db.query.tools.findMany({
      columns: {
        types: true,
        categories: true,
        tags: true,
      },
    });

    let hasTypes = 0;
    let hasCategories = 0;
    let hasTags = 0;

    for (const tool of allTools) {
      if (tool.types) hasTypes++;
      if (tool.categories) hasCategories++;
      if (tool.tags) hasTags++;
    }

    console.log('\n\n📈 统计信息:');
    console.log(`  总工具数: ${allTools.length}`);
    console.log(`  有 types 的: ${hasTypes}`);
    console.log(`  有 categories 的: ${hasCategories}`);
    console.log(`  有 tags 的: ${hasTags}`);
  } catch (error) {
    console.error('❌ 查询出错:', error);
  }

  process.exit(0);
}

checkToolsTags();
