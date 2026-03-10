/**
 * 标签系统统一迁移脚本
 * 将 types、categories、tags 三个字段合并为统一的 tags 字段
 *
 * 使用方法：
 *   pnpm tsx scripts/migrate-tags-consolidation.ts
 *   pnpm tsx scripts/migrate-tags-consolidation.ts --dry-run  # 仅预览，不执行
 */

import { resolve } from 'node:path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { tools } from '../src/db/schema';

async function migrateTagsConsolidation() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('🔍 DRY RUN 模式 - 仅预览，不执行数据库操作\n');
  }

  const db = await getDb();

  try {
    // 1. 获取所有工具
    console.log('📊 正在查询所有工具...\n');
    const allTools = await db.query.tools.findMany({
      columns: {
        id: true,
        name: true,
        types: true,
        categories: true,
        tags: true,
      },
    });

    console.log(`找到 ${allTools.length} 个工具\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. 遍历每个工具，合并标签
    for (const tool of allTools) {
      try {
        // 解析现有的三个字段
        let types: string[] = [];
        let categories: string[] = [];
        let tags: string[] = [];

        try {
          types = tool.types ? JSON.parse(tool.types) : [];
        } catch {
          console.warn(`⚠️  工具 ${tool.name} 的 types 字段解析失败`);
        }

        try {
          categories = tool.categories ? JSON.parse(tool.categories) : [];
        } catch {
          console.warn(`⚠️  工具 ${tool.name} 的 categories 字段解析失败`);
        }

        try {
          tags = tool.tags ? JSON.parse(tool.tags) : [];
        } catch {
          console.warn(`⚠️  工具 ${tool.name} 的 tags 字段解析失败`);
        }

        // 合并并去重
        const mergedTags = Array.from(
          new Set([...types, ...categories, ...tags].filter(Boolean))
        );

        // 如果没有任何标签，跳过
        if (mergedTags.length === 0) {
          console.log(`⏭️  跳过 ${tool.name} - 没有标签`);
          skippedCount++;
          continue;
        }

        console.log(`\n📝 工具: ${tool.name}`);
        console.log(`   原 types: ${JSON.stringify(types)}`);
        console.log(`   原 categories: ${JSON.stringify(categories)}`);
        console.log(`   原 tags: ${JSON.stringify(tags)}`);
        console.log(`   ➡️  合并后: ${JSON.stringify(mergedTags)}`);

        // 更新数据库
        if (!isDryRun) {
          await db
            .update(tools)
            .set({
              tags: JSON.stringify(mergedTags),
              updatedAt: new Date(),
            })
            .where(eq(tools.id, tool.id));
        }

        updatedCount++;
      } catch (error) {
        console.error(`❌ 处理工具 ${tool.name} 时出错:`, error);
        errorCount++;
      }
    }

    // 3. 输出统计信息
    console.log('\n' + '='.repeat(50));
    console.log('📊 迁移统计:');
    console.log(`   ✅ 成功更新: ${updatedCount} 个工具`);
    console.log(`   ⏭️  跳过: ${skippedCount} 个工具`);
    console.log(`   ❌ 失败: ${errorCount} 个工具`);
    console.log('='.repeat(50) + '\n');

    if (isDryRun) {
      console.log('💡 这是预览模式，没有实际修改数据库');
      console.log(
        '💡 执行 pnpm tsx scripts/migrate-tags-consolidation.ts 来真正执行迁移\n'
      );
    } else {
      console.log('✅ 迁移完成！\n');
      console.log('📌 下一步：');
      console.log(
        '   1. 运行 pnpm db:generate 生成删除 types 和 categories 字段的迁移'
      );
      console.log('   2. 运行 pnpm db:migrate 应用数据库迁移');
      console.log('   3. 修改代码中所有使用 types 和 categories 的地方\n');
    }
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateTagsConsolidation();
