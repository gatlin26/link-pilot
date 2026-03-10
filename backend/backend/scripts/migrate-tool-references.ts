/**
 * 工具参考内容迁移脚本
 * 将现有工具的 referenceContent 迁移到 toolReferences 表
 *
 * 使用方法：
 *   pnpm tsx scripts/migrate-tool-references.ts
 *   pnpm tsx scripts/migrate-tool-references.ts --dry-run  # 仅预览，不执行
 */

import { resolve } from 'node:path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../src/db';
import { toolReferences, tools } from '../src/db/schema';

async function migrateToolReferences() {
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
        url: true,
        referenceContent: true,
      },
    });

    console.log(`找到 ${allTools.length} 个工具\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. 遍历每个工具
    for (const tool of allTools) {
      const referenceContent = tool.referenceContent?.trim();

      // 跳过没有 referenceContent 的工具
      if (!referenceContent) {
        console.log(`⏭️  跳过 ${tool.name} - 没有参考内容`);
        skippedCount++;
        continue;
      }

      try {
        // 检查是否已存在 toolReferences 记录
        const existing = await db.query.toolReferences.findFirst({
          where: eq(toolReferences.toolId, tool.id),
        });

        if (existing) {
          console.log(`⏭️  跳过 ${tool.name} - 已存在参考记录`);
          skippedCount++;
          continue;
        }

        if (!isDryRun) {
          // 创建 toolReferences 记录
          await db.insert(toolReferences).values({
            id: nanoid(),
            toolId: tool.id,
            submissionId: null,
            url: tool.url,
            source: 'manual', // 标记为手动迁移
            status: 'success',
            rawContent: referenceContent, // 只保存 content 字段
            manualNotes: '从 tools.referenceContent 迁移',
            fetchedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log(`✅ 已迁移 ${tool.name}`);
        } else {
          console.log(`✅ [预览] 将迁移 ${tool.name}`);
        }

        migratedCount++;
      } catch (error) {
        console.error(`❌ 迁移失败 ${tool.name}:`, error);
        errorCount++;
      }
    }

    // 3. 输出统计信息
    console.log('\n========================================');
    console.log('📊 迁移统计');
    console.log('========================================');
    console.log(`总工具数: ${allTools.length}`);
    console.log(`已迁移: ${migratedCount}`);
    console.log(`已跳过: ${skippedCount}`);
    console.log(`失败: ${errorCount}`);
    console.log('========================================\n');

    if (isDryRun) {
      console.log('💡 这是预览模式，没有实际修改数据库');
      console.log(
        '💡 运行 pnpm tsx scripts/migrate-tool-references.ts 执行迁移\n'
      );
    } else {
      console.log('✅ 迁移完成！\n');
    }
  } catch (error) {
    console.error('❌ 迁移过程出错:', error);
    process.exit(1);
  }
}

// 执行迁移
migrateToolReferences()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
